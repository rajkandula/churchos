import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import {
  ANNOUNCEMENT_STATES,
  Announcement,
  type AnnouncementState,
} from "@/models/Announcement";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { logActivity } from "@/lib/audit";
import {
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

const ACTIONS = ["send", "draft", "schedule"] as const;
type Action = (typeof ACTIONS)[number];

/** Newest first — the history column. `?state=` narrows it to one tray. */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("announcements");
    await connectDb();

    const wanted = (req.nextUrl.searchParams.get("state") ?? "").trim();
    const filter: Record<string, unknown> = { churchId: user.churchId };
    if (wanted) {
      if (!(ANNOUNCEMENT_STATES as readonly string[]).includes(wanted))
        return jsonError("Unknown state.");
      // Rows written before drafts existed carry no `state` — they are history.
      filter.state =
        wanted === "sent" ? { $in: ["sent", null] } : (wanted as AnnouncementState);
    }

    // The page asks for everything and splits it into tabs itself, so a flat
    // cap would quietly hide old drafts and far-off schedules behind a burst of
    // sends. Only the delivered history — the one tray whose truncation is
    // harmless — is capped.
    const announcements = wanted
      ? await Announcement.find(filter).sort({ createdAt: -1 }).limit(100).lean()
      : await (async () => {
          const [open, sent] = await Promise.all([
            // Drafts and anything still waiting to go out — few, never truncated.
            Announcement.find({
              churchId: user.churchId,
              state: { $in: ["draft", "scheduled", "cancelled", "failed"] },
            })
              .sort({ createdAt: -1 })
              .lean(),
            // Delivered history — legacy rows carry no `state`.
            Announcement.find({
              churchId: user.churchId,
              state: { $in: ["sent", null] },
            })
              .sort({ createdAt: -1 })
              .limit(100)
              .lean(),
          ]);
          return [...open, ...sent].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        })();
    return NextResponse.json({
      announcements: announcements.map((a) => shapeAnnouncement(a)),
    });
  });
}

/** Compose an announcement: send it now, park it as a draft, or schedule it. */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("announcements");
    const body = await readBody(req);

    const rawAction = String(body.action ?? "").trim();
    const action: Action = (ACTIONS as readonly string[]).includes(rawAction)
      ? (rawAction as Action)
      : // Older clients said `send: false` for "don't deliver this".
        body.send === false
        ? "draft"
        : "send";
    const isDraft = action === "draft";

    const title = String(body.title ?? "").trim();
    if (!title) return jsonError("Please enter a title.");
    if (title.length > 200)
      return jsonError("Title is too long (max 200 characters).");

    const text = String(body.body ?? "").replace(/\r\n/g, "\n").trim();
    if (!text && !isDraft) return jsonError("Please write the announcement.");
    if (text.length > 20000)
      return jsonError("The announcement is too long (max 20,000 characters).");

    const ctaLabel = String(body.ctaLabel ?? "").trim().slice(0, 60);
    const ctaUrl = String(body.ctaUrl ?? "").trim();
    if (ctaUrl && !isHttpUrl(ctaUrl))
      return jsonError("The button link must start with http:// or https://.");
    const theme = normalizeTheme(body.theme);

    let sendAt: Date | null = null;
    if (action === "schedule") {
      const when = parseSendAt(body.sendAt);
      if ("error" in when) return jsonError(when.error);
      sendAt = when.date;
    }

    // A draft may have a half-made audience; anything that will actually be
    // delivered must name a real one.
    let audience: AudienceInput;
    const parsed = parseAudience(body);
    if ("error" in parsed) {
      if (!isDraft) return jsonError(parsed.error);
      audience = looseAudience(body);
    } else {
      audience = parsed;
    }

    await connectDb();

    let groupName = "";
    let recipients = 0;
    if (!("error" in parsed)) {
      const resolved = await resolveAudience(user.churchId, audience);
      if ("error" in resolved) {
        if (!isDraft) return jsonError(resolved.error);
      } else {
        groupName = resolved.groupName;
        recipients = resolved.people.length;
      }
    }

    const announcement = await Announcement.create({
      churchId: user.churchId,
      title,
      body: text,
      audienceType: audience.audienceType,
      status: audience.status,
      tag: audience.tag,
      group: audience.group ? new Types.ObjectId(audience.group) : null,
      groupName,
      channel: "email",
      state: action === "schedule" ? "scheduled" : "draft",
      sendAt,
      dispatchStartedAt: null,
      lastError: "",
      ctaLabel,
      ctaUrl,
      theme,
      recipients,
      sentTo: 0,
      skipped: 0,
      failed: 0,
      sentBy: isDraft ? undefined : new Types.ObjectId(user.id),
      sentByName: isDraft ? "" : user.name,
      createdBy: new Types.ObjectId(user.id),
    });

    const readBack = () =>
      Announcement.findOne({
        _id: announcement._id,
        churchId: user.churchId,
      }).lean();

    let mailUnavailable = false;
    let warning = "";
    let saved: Awaited<ReturnType<typeof readBack>> = null;
    try {
      if (action === "send") {
        const result = await dispatchAnnouncement(announcement.toObject());
        if (result.error === MAIL_UNAVAILABLE) {
          mailUnavailable = true;
          warning = MAIL_UNAVAILABLE_WARNING;
        } else if (result.error) {
          warning = result.error;
        }
      }
      await logActivity(user, "create", "announcement", title, announcement._id);
      saved = await readBack();
    } catch (err) {
      // Never rethrow past this point: withApi retries a dead connection by
      // replaying the whole handler, which would create — and mail — a second
      // announcement. The row exists and the emails may already be out.
      console.error("announcement finish-up failed:", err);
      if (!warning)
        warning =
          "The announcement was saved and may already have gone out, but the server lost its connection while finishing. Check the history before sending it again.";
    }

    return NextResponse.json(
      {
        announcement: shapeAnnouncement(saved ?? announcement.toObject()),
        mailUnavailable,
        ...(warning ? { warning } : {}),
      },
      { status: 201 }
    );
  });
}
