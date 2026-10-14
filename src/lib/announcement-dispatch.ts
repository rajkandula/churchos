import {
  Announcement,
  AUDIENCE_TYPES,
  type AudienceType,
} from "@/models/Announcement";
import { isValidObjectId } from "@/lib/person-fields";
import { Church } from "@/models/Church";
import { isMailConfigured, sendMail } from "@/lib/mail";
import {
  EMAIL_THEMES,
  renderAnnouncementEmail,
  type EmailBranding,
  type EmailTheme,
} from "@/lib/email-render";
import {
  resolveAudience,
  type AudienceInput,
  type AudiencePerson,
} from "@/lib/announcement-audience";

/** Sent in slices so one huge list never fires thousands of requests at once. */
const BATCH_SIZE = 20;

/**
 * How long a dispatch may hold its claim before anyone else may take it over.
 *
 * A live claim (under this) blocks a duplicate cron tick or an impatient second
 * click; past it the claim is assumed to belong to a server process that was
 * killed mid-send, and the row is recoverable again. There is no per-recipient ledger,
 * so taking over a claim re-mails the whole audience — this window must stay
 * comfortably longer than the longest realistic send.
 */
export const CLAIM_TTL_MS = 15 * 60_000;

/** `error` value that means "nothing is wrong with the announcement — this
 *  server just has no mail transport configured" (no HARAKUMO_API_KEY).
 *  Routes turn it into the `mailUnavailable` flag rather than an error
 *  message. */
export const MAIL_UNAVAILABLE = "mail-unavailable";

/** What the composer shows when the server has no way to send mail. */
export const MAIL_UNAVAILABLE_WARNING =
  "Email sending is not set up on this server yet (HARAKUMO_API_KEY). The announcement was saved, but no emails went out.";

const THEME_VALUES: readonly string[] = EMAIL_THEMES.map((t) => t.value);

/** Whitelist a theme name coming from a request body or an old row. */
export function normalizeTheme(value: unknown): EmailTheme {
  const v = String(value ?? "").trim();
  return (THEME_VALUES.includes(v) ? v : "classic") as EmailTheme;
}

/** A call-to-action link must be a real web address — never `javascript:`. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Parse a scheduled send time. It has to be readable and still ahead of us. */
export function parseSendAt(value: unknown): { date: Date } | { error: string } {
  const raw = String(value ?? "").trim();
  if (!raw) return { error: "Pick the date and time to send this." };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime()))
    return { error: "That send time isn't a valid date." };
  if (date.getTime() <= Date.now())
    return { error: "Pick a send time in the future." };
  return { date };
}

export type DispatchResult = {
  sentTo: number;
  skipped: number;
  failed: number;
  recipients: number;
  error?: string;
};

/** Everything the dispatcher needs to find the row; the content it re-reads
 *  itself, so a caller can never send a stale draft. */
export type DispatchableAnnouncement = {
  _id: unknown;
  churchId: unknown;
  state?: string | null;
};

function firstErrorMessage(results: PromiseSettledResult<void>[]): string {
  for (const r of results) {
    if (r.status === "rejected") {
      return r.reason instanceof Error
        ? r.reason.message
        : String(r.reason ?? "Send failed.");
    }
  }
  return "";
}

/**
 * Send one announcement and write the outcome back onto the row.
 *
 * Both the "send now" button and the cron tick call this, so behaviour cannot
 * drift between them. It is safe to call twice: the row is claimed with a
 * conditional update before anything is resolved or sent, so a second caller
 * (a duplicate cron tick, an impatient click) finds nothing to claim and
 * returns without sending. Every write afterwards is conditional on that same
 * claim, so a dispatch that lost it — cancelled, or taken over once the claim
 * went stale — can no longer overwrite the row.
 */
export async function dispatchAnnouncement(
  doc: DispatchableAnnouncement
): Promise<DispatchResult> {
  const id = String(doc._id);
  const churchId = String(doc.churchId);
  const wasScheduled = doc.state === "scheduled";
  const key = { _id: id, churchId };

  // ── Claim ──────────────────────────────────────────────────────────
  // The exact stamp written is this dispatch's identity: every later write is
  // conditional on it, so a dispatch that lost its claim writes nothing.
  const claimedAt = new Date();
  const claimedState = wasScheduled ? "scheduled" : "draft";
  const claimed = await Announcement.findOneAndUpdate(
    {
      ...key,
      state: claimedState,
      $or: [
        { dispatchStartedAt: null },
        // A claim older than the TTL belonged to a process that died mid-send;
        // taking it over is the only way that row is ever picked up again.
        { dispatchStartedAt: { $lt: new Date(Date.now() - CLAIM_TTL_MS) } },
      ],
    },
    { $set: { dispatchStartedAt: claimedAt } },
    { new: true }
  ).lean();

  if (!claimed) {
    return {
      sentTo: 0,
      skipped: 0,
      failed: 0,
      recipients: 0,
      error: "This announcement is already on its way — nothing to send.",
    };
  }

  /** This row, but only while this dispatch still holds the claim. */
  const claimKey = { ...key, dispatchStartedAt: claimedAt };

  /** Put the claim down again so the row can be tried later. Scoped to our own
   *  claim, so it can never clear or overwrite a newer dispatch's. */
  const release = async (
    fields: Record<string, unknown>,
    filter: Record<string, unknown> = {}
  ) => {
    await Announcement.updateOne(
      { ...claimKey, ...filter },
      { $set: { dispatchStartedAt: null, ...fields } }
    );
  };

  // ── Audience ───────────────────────────────────────────────────────
  const audience: AudienceInput = {
    audienceType: (claimed.audienceType ?? "all") as AudienceType,
    status: claimed.status ?? "",
    tag: claimed.tag ?? "",
    group: claimed.group ? String(claimed.group) : "",
  };
  const resolved = await resolveAudience(churchId, audience);
  if ("error" in resolved) {
    await release({
      state: claimedState,
      lastError: resolved.error,
    });
    return { sentTo: 0, skipped: 0, failed: 0, recipients: 0, error: resolved.error };
  }

  const recipients = resolved.people.length;
  const withEmail = resolved.people.filter((p) => p.email);
  const skipped = recipients - withEmail.length;

  // ── No mail transport configured ──────────────────────────────────────
  if (!isMailConfigured()) {
    // Never mark it sent. A scheduled one stays scheduled and a later tick
    // picks it up once mail is configured; an immediate one stays a draft the
    // office can send again.
    await release({
      state: claimedState,
      recipients,
      skipped,
      sentTo: 0,
      failed: 0,
      lastError: "Email sending is unavailable on this server.",
    });
    return { sentTo: 0, skipped, failed: 0, recipients, error: MAIL_UNAVAILABLE };
  }

  // ── Nobody to email ────────────────────────────────────────────────
  // Nothing was delivered, so this is not history. Mark it failed, keep the
  // counts, put the claim down: the row stays in the Scheduled tray, shows the
  // reason and a Retry, and the office can fix the audience and send again.
  if (!withEmail.length) {
    const message = recipients
      ? "Nobody in this audience has an email address."
      : "This audience matched nobody — check the tag, group or status.";
    await release(
      {
        state: "failed",
        recipients,
        skipped,
        sentTo: 0,
        failed: 0,
        lastError: message,
      },
      { state: claimedState }
    );
    return { sentTo: 0, skipped, failed: 0, recipients, error: message };
  }

  // ── Render once, under the church's own branding ────────────────────
  const church = await Church.findById(churchId)
    .select("name logoUrl address website pastorName")
    .lean();
  const branding: EmailBranding = {
    churchName: church?.name || "Your church",
    logoUrl: church?.logoUrl || undefined,
    address: church?.address || undefined,
    website: church?.website || undefined,
    pastorName: church?.pastorName || undefined,
  };
  const { html, text } = renderAnnouncementEmail({
    title: claimed.title,
    body: claimed.body ?? "",
    branding,
    ctaLabel: claimed.ctaLabel || undefined,
    ctaUrl: claimed.ctaUrl || undefined,
    theme: normalizeTheme(claimed.theme),
  });

  // ── Send ───────────────────────────────────────────────────────────
  let sentTo = 0;
  let failed = 0;
  let lastError = "";
  let stoppedEarly = false;
  for (let i = 0; i < withEmail.length; i += BATCH_SIZE) {
    if (i > 0) {
      // Between batches, honour anything that has happened to the row since we
      // claimed it — a cancel, or a claim taken over. What has gone out has
      // gone, but nothing more will.
      const live = await Announcement.findOne(claimKey).select("state").lean();
      if (!live || live.state !== claimedState) {
        stoppedEarly = true;
        break;
      }
    }
    const batch: AudiencePerson[] = withEmail.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((p) =>
        sendMail({ to: p.email, subject: claimed.title, text, html })
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled") sentTo++;
      else failed++;
    }
    if (!lastError) lastError = firstErrorMessage(results);
  }

  // Stopped between batches: record only what actually went out and leave
  // `state` alone, so the "cancelled" the office asked for survives.
  if (stoppedEarly) {
    await Announcement.updateOne(claimKey, {
      $set: {
        recipients,
        skipped,
        sentTo,
        failed,
        dispatchStartedAt: null,
        lastError: `Cancelled part-way — ${sentTo} email${
          sentTo === 1 ? "" : "s"
        } had already gone out.`,
      },
    });
    return {
      sentTo,
      skipped,
      failed,
      recipients,
      error: "Cancelled while sending.",
    };
  }

  const state = sentTo > 0 ? "sent" : "failed";
  await Announcement.updateOne(
    { ...claimKey, state: claimedState },
    {
      $set: {
        state,
        recipients,
        skipped,
        sentTo,
        failed,
        lastError: failed ? lastError : "",
        // Nothing left at all? Then it was never sent: no sentAt, no claim, so
        // the office can fix whatever went wrong and try again.
        ...(state === "sent"
          ? { sentAt: new Date() }
          : { dispatchStartedAt: null }),
      },
    }
  );

  return {
    sentTo,
    skipped,
    failed,
    recipients,
    ...(state === "failed" ? { error: lastError || "No emails could be sent." } : {}),
  };
}

/** How many announcements one scheduler tick will send. Ticks come every five
 *  minutes, so a backlog drains quickly without any single tick running long. */
const PER_TICK = 5;

/** …and how many emails, across those announcements. The check happens before
 *  each announcement starts, which bounds the overrun to a single audience
 *  rather than the whole batch. */
const RECIPIENT_BUDGET = 500;

/**
 * Send every scheduled announcement that has come due — across all churches.
 * Called by the in-process scheduler (src/lib/announcement-scheduler.ts) and
 * by POST /api/cron/dispatch-announcements for an external scheduler. The
 * caller connects to the database first.
 */
export async function dispatchDueAnnouncements(): Promise<{
  dispatched: number;
  failed: number;
}> {
  // Deliberately not scoped to one church: the scheduler serves every
  // tenant, and each announcement carries the churchId its audience and
  // branding are read from.
  const due = await Announcement.find({
    state: "scheduled",
    sendAt: { $ne: null, $lte: new Date() },
    // A row whose claim has gone stale was left behind by a tick that was
    // killed mid-send; without this it would be invisible to the scheduler
    // forever. Re-picking it re-mails the whole audience, which is why the
    // TTL has to exceed the longest realistic send.
    $or: [
      { dispatchStartedAt: null },
      { dispatchStartedAt: { $lt: new Date(Date.now() - CLAIM_TTL_MS) } },
    ],
  })
    .select("_id churchId state")
    .sort({ sendAt: 1 })
    .limit(PER_TICK)
    .lean();

  let dispatched = 0;
  let failed = 0;
  let spent = 0;
  for (const row of due) {
    // Out of budget: leave the rest for the next tick, five minutes away.
    if (spent >= RECIPIENT_BUDGET) break;
    try {
      const result = await dispatchAnnouncement({
        _id: row._id,
        churchId: row.churchId,
        state: "scheduled",
      });
      spent += result.recipients;
      if (result.error) failed++;
      else dispatched++;
    } catch (err) {
      failed++;
      console.error("scheduled announcement failed:", String(row._id), err);
    }
  }
  return { dispatched, failed };
}

/* ────────────────────────────────────────────────────────────────────────
 * Shared shapes — used by every announcement route so the DTO the browser
 * sees is identical whichever endpoint produced it.
 * ──────────────────────────────────────────────────────────────────────── */

/** One announcement as the client sees it. Legacy rows written before drafts
 *  existed have no `state`/`theme`; they are all delivered history. */
export function shapeAnnouncement(a: Record<string, unknown>) {
  return {
    ...a,
    _id: String(a._id),
    group: a.group ? String(a.group) : null,
    state: (a.state as string) || "sent",
    sendAt: (a.sendAt as Date | null) ?? null,
    ctaLabel: (a.ctaLabel as string) ?? "",
    ctaUrl: (a.ctaUrl as string) ?? "",
    theme: normalizeTheme(a.theme),
    lastError: (a.lastError as string) ?? "",
  };
}

/** A draft may be half-finished: keep whatever audience choice was made
 *  without insisting it is complete enough to send. */
export function looseAudience(body: Record<string, unknown>): AudienceInput {
  const raw = String(body.audienceType ?? "all");
  const audienceType = (AUDIENCE_TYPES as readonly string[]).includes(raw)
    ? (raw as AudienceType)
    : "all";
  const group = String(body.group ?? "").trim();
  return {
    audienceType,
    status: audienceType === "status" ? String(body.status ?? "").trim() : "",
    tag:
      audienceType === "tag"
        ? String(body.tag ?? "").trim().toLowerCase()
        : "",
    group:
      audienceType === "group" && isValidObjectId(group) ? group : "",
  };
}
