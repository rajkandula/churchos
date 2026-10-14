import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Event } from "@/models/Event";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { logActivity } from "@/lib/audit";
import { randomCode } from "@/lib/public-church";
import { withSeqRetry } from "@/lib/seq";
import { pickEventFields, registeredCounts, serializeEvent } from "@/lib/events";
import { EVENT_STATUSES } from "@/app/dashboard/events/types";

/** List events — `q`, `status`, `upcoming=1` or `past=1`. */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("events");
    await connectDb();

    const params = req.nextUrl.searchParams;
    const filter: Record<string, unknown> = { churchId: user.churchId };
    const q = (params.get("q") ?? "").trim();
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: re }, { venue: re }, { organizerName: re }, { tags: re }];
    }
    const status = (params.get("status") ?? "").trim();
    if (status && (EVENT_STATUSES as readonly string[]).includes(status))
      filter.status = status;

    const now = new Date();
    const upcoming = params.get("upcoming") === "1";
    const past = params.get("past") === "1";
    if (upcoming) {
      // Still running counts as upcoming
      filter.$and = [
        { $or: [{ endAt: { $gte: now } }, { endAt: null, startAt: { $gte: now } }] },
      ];
    } else if (past) {
      filter.$and = [
        { $or: [{ endAt: { $lt: now } }, { endAt: null, startAt: { $lt: now } }] },
      ];
    }

    const events = await Event.find(filter)
      .sort({ startAt: upcoming ? 1 : -1 })
      .limit(500)
      .lean();
    const counts = await registeredCounts(
      user.churchId,
      events.map((e) => e._id)
    );

    return NextResponse.json({
      events: events.map((e) => serializeEvent(e, counts.get(String(e._id)) ?? 0)),
    });
  });
}

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("events");
    const body = await readBody(req);

    const { data, error } = pickEventFields({
      ...body,
      title: body.title ?? "",
      startAt: body.startAt ?? "",
    });
    if (error) return jsonError(error);

    await connectDb();
    if (data.organizer) {
      const organizer = await Person.findOne({
        _id: data.organizer,
        churchId: user.churchId,
      })
        .select("name")
        .lean();
      if (!organizer) return jsonError("Organizer not found in People.");
      data.organizerName = organizer.name;
    }

    // publicSlug is globally unique — retry on the (very unlikely) collision
    const event = await withSeqRetry(() =>
      Event.create({
        churchId: user.churchId,
        ...data,
        publicSlug: randomCode(8),
        createdBy: new Types.ObjectId(user.id),
      })
    );
    if (!event) return jsonError("Could not create the event. Try again.", 500);

    await logActivity(user, "create", "event", event.title, event._id);

    return NextResponse.json(
      { event: serializeEvent(event.toObject(), 0) },
      { status: 201 }
    );
  });
}
