import { Types } from "mongoose";
import { Event, type EventDoc } from "@/models/Event";
import { Registration } from "@/models/Registration";
import { isValidObjectId } from "@/lib/person-fields";
import { randomCode } from "@/lib/public-church";
import { withSeqRetry } from "@/lib/seq";
import {
  EVENT_STATUSES,
  REGISTRATION_STATUSES,
  type EventStats,
} from "@/app/dashboard/events/types";

export const PHONE_RE = /^[0-9+\-\s()]{6,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Statuses that hold a seat — waitlisted and cancelled don't. */
export const SEAT_STATUSES = ["registered", "attended"] as const;

/** Whitelist + normalise the editable fields of an Event from a request body.
 *  Returns an error message for the first invalid field. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pickEventFields(body: any): {
  data: Record<string, unknown>;
  error?: string;
} {
  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = String(body.title ?? "").trim();
    if (!title) return { data, error: "Please give the event a title." };
    data.title = title.slice(0, 200);
  }
  for (const key of ["description", "venue", "organizerName"] as const) {
    if (body[key] !== undefined) data[key] = String(body[key] ?? "").trim();
  }
  if (body.coverUrl !== undefined) {
    const coverUrl = String(body.coverUrl ?? "").trim();
    if (coverUrl && !/^https?:\/\//.test(coverUrl))
      return { data, error: "Cover image must be an uploaded image." };
    data.coverUrl = coverUrl;
  }
  if (body.startAt !== undefined) {
    const d = new Date(String(body.startAt ?? ""));
    if (Number.isNaN(d.getTime()))
      return { data, error: "Please choose when the event starts." };
    data.startAt = d;
  }
  if (body.endAt !== undefined) {
    const raw = String(body.endAt ?? "").trim();
    if (!raw) data.endAt = null;
    else {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime()))
        return { data, error: "The end time is not a valid date." };
      data.endAt = d;
    }
  }
  if (data.startAt && data.endAt && (data.endAt as Date) < (data.startAt as Date))
    return { data, error: "The event can't end before it starts." };

  if (body.capacity !== undefined) {
    const raw = String(body.capacity ?? "").trim();
    if (!raw) data.capacity = null;
    else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0)
        return { data, error: "Capacity must be a whole number." };
      data.capacity = n;
    }
  }
  if (body.fee !== undefined) {
    const n = Number(String(body.fee ?? "0").trim() || 0);
    if (!Number.isFinite(n) || n < 0)
      return { data, error: "Fee must be zero or a positive amount." };
    data.fee = n;
  }
  if (body.registrationOpen !== undefined)
    data.registrationOpen = Boolean(body.registrationOpen);
  if (body.status !== undefined) {
    const status = String(body.status ?? "");
    if (!(EVENT_STATUSES as readonly string[]).includes(status))
      return { data, error: "Invalid event status." };
    data.status = status;
  }
  if (body.organizer !== undefined) {
    const v = String(body.organizer ?? "").trim();
    data.organizer = v && isValidObjectId(v) ? v : null;
  }
  if (body.tags !== undefined) {
    const raw: unknown[] = Array.isArray(body.tags)
      ? body.tags
      : String(body.tags ?? "").split(",");
    data.tags = Array.from(
      new Set(raw.map((t) => String(t).trim().toLowerCase()).filter(Boolean))
    ).slice(0, 30);
  }
  return { data };
}

/** Seats taken per event — registered + attended, each counting 1 + guests. */
export async function registeredCounts(
  churchId: string,
  eventIds: (string | Types.ObjectId)[]
): Promise<Map<string, number>> {
  if (!eventIds.length) return new Map();
  const rows = await Registration.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        churchId: new Types.ObjectId(churchId),
        event: { $in: eventIds.map((id) => new Types.ObjectId(String(id))) },
        status: { $in: [...SEAT_STATUSES] },
      },
    },
    {
      $group: {
        _id: "$event",
        count: { $sum: { $add: [1, { $ifNull: ["$guests", 0] }] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export function spotsLeftFor(
  capacity: number | null | undefined,
  registeredCount: number
): number | null {
  if (capacity === null || capacity === undefined) return null;
  return Math.max(0, capacity - registeredCount);
}

/** Full breakdown for the event detail page's stat tiles. */
export async function eventStats(
  churchId: string,
  eventId: string,
  capacity: number | null | undefined
): Promise<EventStats> {
  const rows = await Registration.aggregate<{
    _id: string;
    people: number;
    seats: number;
  }>([
    {
      $match: {
        churchId: new Types.ObjectId(churchId),
        event: new Types.ObjectId(eventId),
      },
    },
    {
      $group: {
        _id: "$status",
        people: { $sum: 1 },
        seats: { $sum: { $add: [1, { $ifNull: ["$guests", 0] }] } },
      },
    },
  ]);
  const byStatus = new Map(rows.map((r) => [r._id, r]));
  const count = (s: string) => byStatus.get(s)?.people ?? 0;
  const registeredCount = SEAT_STATUSES.reduce(
    (sum, s) => sum + (byStatus.get(s)?.seats ?? 0),
    0
  );
  return {
    registered: count("registered"),
    waitlisted: count("waitlisted"),
    attended: count("attended"),
    cancelled: count("cancelled"),
    registeredCount,
    spotsLeft: spotsLeftFor(capacity, registeredCount),
  };
}

/** API shape of an event (ids as strings, counts attached). */
export function serializeEvent(
  e: EventDoc & { _id: Types.ObjectId },
  registeredCount: number
) {
  return {
    ...e,
    _id: String(e._id),
    organizer: e.organizer ? String(e.organizer) : null,
    churchId: String(e.churchId),
    createdBy: e.createdBy ? String(e.createdBy) : null,
    registeredCount,
    spotsLeft: spotsLeftFor(e.capacity, registeredCount),
  };
}

/** Give an event its public slug if it doesn't have one yet. */
export async function ensureEventSlug(
  event: EventDoc & { _id: Types.ObjectId }
): Promise<string> {
  if (event.publicSlug) return event.publicSlug;
  const slug = await withSeqRetry(async () => {
    const candidate = randomCode(8);
    await Event.updateOne(
      { _id: event._id, publicSlug: { $in: [null, ""] } },
      { $set: { publicSlug: candidate } }
    );
    return candidate;
  });
  if (!slug) throw new Error("Could not allocate a public link.");
  return slug;
}

export function isRegistrationStatus(value: unknown): boolean {
  return (REGISTRATION_STATUSES as readonly string[]).includes(String(value));
}

/** An existing live signup with the same phone or email on this event. */
export async function findDuplicateRegistration(
  churchId: string,
  eventId: string | Types.ObjectId,
  phone: string,
  email: string
) {
  const or: Record<string, string>[] = [];
  if (phone) or.push({ phone });
  if (email) or.push({ email });
  if (!or.length) return null;
  return Registration.findOne({
    churchId,
    event: eventId,
    status: { $ne: "cancelled" },
    $or: or,
  }).lean();
}
