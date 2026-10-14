import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Event } from "@/models/Event";
import { Registration } from "@/models/Registration";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";
import { eventStats, pickEventFields, serializeEvent } from "@/lib/events";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("events");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Event not found.", 404);

    await connectDb();
    const event = await Event.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!event) return jsonError("Event not found.", 404);

    const stats = await eventStats(user.churchId, id, event.capacity);
    return NextResponse.json({
      event: serializeEvent(event, stats.registeredCount),
      stats,
    });
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("events");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Event not found.", 404);
    const body = await readBody(req);

    const { data, error } = pickEventFields(body);
    if (error) return jsonError(error);

    await connectDb();
    const current = await Event.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!current) return jsonError("Event not found.", 404);

    // End-before-start check across the stored value when only one side changes
    const startAt = (data.startAt as Date | undefined) ?? current.startAt;
    const endAt =
      data.endAt !== undefined ? (data.endAt as Date | null) : current.endAt;
    if (endAt && startAt && endAt < startAt)
      return jsonError("The event can't end before it starts.");

    if (data.organizer !== undefined) {
      if (data.organizer) {
        const organizer = await Person.findOne({
          _id: data.organizer,
          churchId: user.churchId,
        })
          .select("name")
          .lean();
        if (!organizer) return jsonError("Organizer not found in People.");
        data.organizerName = organizer.name;
      } else if (body.organizerName === undefined) {
        data.organizerName = "";
      }
    }

    const event = await Event.findOneAndUpdate(
      { _id: id, churchId: user.churchId },
      data,
      { new: true, runValidators: true }
    ).lean();
    if (!event) return jsonError("Event not found.", 404);

    await logActivity(user, "update", "event", event.title, id);

    const stats = await eventStats(user.churchId, id, event.capacity);
    return NextResponse.json({
      event: serializeEvent(event, stats.registeredCount),
      stats,
    });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("events");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Event not found.", 404);

    await connectDb();
    const event = await Event.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!event) return jsonError("Event not found.", 404);

    // Registrations ride along so a restore brings the whole event back
    const registrations = await Registration.find({
      churchId: user.churchId,
      event: event._id,
    }).lean();

    await moveToRecycleBin({
      user,
      itemType: "event",
      label: event.title,
      doc: event,
      related: registrations.length
        ? { collection: "registrations", docs: registrations }
        : null,
    });
    await Registration.deleteMany({ churchId: user.churchId, event: event._id });
    await Event.deleteOne({ _id: id, churchId: user.churchId });

    return NextResponse.json({ ok: true });
  });
}
