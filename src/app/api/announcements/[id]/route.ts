import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Announcement, type AudienceType } from "@/models/Announcement";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";
import {
  CLAIM_TTL_MS,
  dispatchAnnouncement,
  isHttpUrl,
  looseAudience,
  MAIL_UNAVAILABLE,
  MAIL_UNAVAILABLE_WARNING,
  normalizeTheme,
  parseSendAt,
  shapeAnnouncement,
} from "@/lib/announcement-dispatch";
import {
  parseAudience,
  resolveAudience,
  type AudienceInput,
} from "@/lib/announcement-audience";

type Params = { params: Promise<{ id: string }> };

/** Sent announcements are history: they can be read and deleted, never edited. */
const EDITABLE_STATES = ["draft", "scheduled", "cancelled", "failed"];
const PATCH_ACTIONS = ["cancel", "send-now", "reschedule"];

export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("announcements");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Announcement not found.", 404);

    await connectDb();
    const announcement = await Announcement.findOne({
      _id: id,
      churchId: user.churchId,
    }).lean();
    if (!announcement) return jsonError("Announcement not found.", 404);

    return NextResponse.json({ announcement: shapeAnnouncement(announcement) });
  });
}

/** Edit a draft, cancel or reschedule a scheduled one, or send it right now. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("announcements");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Announcement not found.", 404);
    const body = await readBody(req);

    const action = String(body.action ?? "").trim();
    if (action && !PATCH_ACTIONS.includes(action))
      return jsonError("Unknown action.");

    await connectDb();
    const existing = await Announcement.findOne({
      _id: id,
      churchId: user.churchId,
    }).lean();
    if (!existing) return jsonError("Announcement not found.", 404);

    const state = existing.state ?? "sent";
    if (!EDITABLE_STATES.includes(state))
      return jsonError(
        "This announcement has already gone out — it's history now and can't be changed."
      );

    // A dispatch in flight owns this row — its claim must not be cleared under
    // it, or the send-now below would re-claim and re-mail the whole audience
    // while the first send is still working through it. Past the TTL the claim
    // belongs to a process that died, and clearing it is the deliberate operator
    // recovery — the only one a stale-claimed *draft* has, since the cron
    // sweeps scheduled rows only.
    const claimedAt = existing.dispatchStartedAt
      ? new Date(existing.dispatchStartedAt).getTime()
      : 0;
    if (claimedAt && Date.now() - claimedAt < CLAIM_TTL_MS)
      return jsonError(
        "This announcement is being sent right now — give it a few minutes and refresh.",
        409
      );

    const set: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) return jsonError("Please enter a title.");
      if (title.length > 200)
        return jsonError("Title is too long (max 200 characters).");
      set.title = title;
    }
    if (body.body !== undefined) {
      const text = String(body.body).replace(/\r\n/g, "\n").trim();
      if (text.length > 20000)
        return jsonError("The announcement is too long (max 20,000 characters).");
      set.body = text;
    }
    if (body.ctaLabel !== undefined)
      set.ctaLabel = String(body.ctaLabel).trim().slice(0, 60);
    if (body.ctaUrl !== undefined) {
      const ctaUrl = String(body.ctaUrl).trim();
      if (ctaUrl && !isHttpUrl(ctaUrl))
        return jsonError("The button link must start with http:// or https://.");
      set.ctaUrl = ctaUrl;
    }
    if (body.theme !== undefined) set.theme = normalizeTheme(body.theme);

    // ── Audience ─────────────────────────────────────────────────────
    let audience: AudienceInput | null = null;
    if (body.audienceType !== undefined) {
      const parsed = parseAudience(body);
      if ("error" in parsed) {
        // Anything about to be delivered needs a complete audience.
        if (action === "send-now" || action === "reschedule")
          return jsonError(parsed.error);
        audience = looseAudience(body);
      } else {
        audience = parsed;
      }
      set.audienceType = audience.audienceType;
      set.status = audience.status;
      set.tag = audience.tag;
      set.group = audience.group ? new Types.ObjectId(audience.group) : null;
      set.groupName = "";
      if (!("error" in parsed)) {
        const resolved = await resolveAudience(user.churchId, audience);
        if ("error" in resolved) {
          if (action === "send-now" || action === "reschedule")
            return jsonError(resolved.error);
        } else {
          set.groupName = resolved.groupName;
          set.recipients = resolved.people.length;
        }
      }
    }

    // What the row will look like once this update lands.
    const finalTitle = (set.title as string) ?? existing.title ?? "";
    const finalBody = (set.body as string) ?? existing.body ?? "";
    const finalAudience: AudienceInput = audience ?? {
      audienceType: (existing.audienceType ?? "all") as AudienceType,
      status: existing.status ?? "",
      tag: existing.tag ?? "",
      group: existing.group ? String(existing.group) : "",
    };

    // ── Actions ──────────────────────────────────────────────────────
    if (action === "send-now" || action === "reschedule") {
      if (!finalTitle) return jsonError("Please enter a title.");
      if (!finalBody) return jsonError("Please write the announcement.");
      const check = parseAudience(finalAudience);
      if ("error" in check) return jsonError(check.error);
    }

    if (action === "cancel") {
      set.state = "cancelled";
      set.lastError = "";
    } else if (action === "reschedule") {
      const when = parseSendAt(body.sendAt);
      if ("error" in when) return jsonError(when.error);
      set.state = "scheduled";
      set.sendAt = when.date;
      set.lastError = "";
      set.dispatchStartedAt = null;
      set.sentBy = new Types.ObjectId(user.id);
      set.sentByName = user.name;
    } else if (action === "send-now") {
      // Normalise to a claimable draft first, whatever it was before.
      set.state = "draft";
      set.sendAt = null;
      set.lastError = "";
      set.dispatchStartedAt = null;
      set.sentBy = new Types.ObjectId(user.id);
      set.sentByName = user.name;
    } else if (body.sendAt !== undefined && state === "scheduled") {
      const when = parseSendAt(body.sendAt);
      if ("error" in when) return jsonError(when.error);
      set.sendAt = when.date;
    }

    await Announcement.updateOne(
      { _id: id, churchId: user.churchId },
      { $set: set }
    );
    await logActivity(user, "update", "announcement", finalTitle, id);

    const readBack = () =>
      Announcement.findOne({ _id: id, churchId: user.churchId }).lean();

    let mailUnavailable = false;
    let warning = "";
    let saved: Awaited<ReturnType<typeof readBack>> = null;
    try {
      if (action === "send-now") {
        const result = await dispatchAnnouncement({
          _id: id,
          churchId: user.churchId,
          state: "draft",
        });
        if (result.error === MAIL_UNAVAILABLE) {
          mailUnavailable = true;
          warning = MAIL_UNAVAILABLE_WARNING;
        } else if (result.error) {
          warning = result.error;
        }
      }
      saved = await readBack();
    } catch (err) {
      // Never rethrow past this point: withApi retries a dead connection by
      // replaying the whole handler, which would clear `dispatchStartedAt` and
      // mail this announcement a second time. Answer with what we wrote.
      console.error("announcement send finish-up failed:", err);
      if (!warning)
        warning =
          "The announcement may already have gone out, but the server lost its connection while finishing. Check the history before sending it again.";
    }

    return NextResponse.json({
      announcement: shapeAnnouncement(saved ?? { ...existing, ...set }),
      ...(action === "send-now" ? { mailUnavailable } : {}),
      ...(warning ? { warning } : {}),
    });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("announcements");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Announcement not found.", 404);

    await connectDb();
    const announcement = await Announcement.findOne({
      _id: id,
      churchId: user.churchId,
    }).lean();
    if (!announcement) return jsonError("Announcement not found.", 404);

    await moveToRecycleBin({
      user,
      itemType: "announcement",
      label: announcement.title,
      doc: announcement,
    });
    await Announcement.deleteOne({ _id: id, churchId: user.churchId });

    return NextResponse.json({ ok: true });
  });
}
