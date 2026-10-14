import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Event } from "@/models/Event";
import { Registration } from "@/models/Registration";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { seqLabel, withSeqRetry } from "@/lib/seq";
import { logActivity, moveToRecycleBin } from "@/lib/audit";
import { EMAIL_RE, PHONE_RE, eventStats, isRegistrationStatus } from "@/lib/events";

type Params = { params: Promise<{ id: string; regId: string }> };

function serialize(r: {
  _id: unknown;
  event: unknown;
  person?: unknown;
  [k: string]: unknown;
}) {
  return {
    ...r,
    _id: String(r._id),
    event: String(r.event),
    person: r.person ? String(r.person) : null,
  };
}

/** Update a signup (status / guests / notes / contact), or
 *  `{ action: "createPerson" }` to turn a public registrant into a Person. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("events");
    const { id, regId } = await params;
    if (!isValidObjectId(id)) return jsonError("Event not found.", 404);
    if (!isValidObjectId(regId)) return jsonError("Registration not found.", 404);
    const body = await readBody(req);

    await connectDb();
    const event = await Event.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!event) return jsonError("Event not found.", 404);
    const registration = await Registration.findOne({
      _id: regId,
      churchId: user.churchId,
      event: id,
    });
    if (!registration) return jsonError("Registration not found.", 404);

    if (body.action === "createPerson") {
      if (registration.person) {
        const linked = await Person.findOne({
          _id: registration.person,
          churchId: user.churchId,
        })
          .select("_id")
          .lean();
        if (linked) return jsonError("This registrant is already in People.", 409);
      }
      const person = await withSeqRetry(async (attempt) => {
        const seq =
          (await Person.countDocuments({ churchId: user.churchId })) + 1 + attempt;
        return Person.create({
          churchId: user.churchId,
          memberNo: seqLabel("P", seq),
          name: registration.name,
          phone: registration.phone ?? "",
          email: registration.email ?? "",
          status: "visitor",
          source: "Event / outreach",
          firstVisit: event.startAt,
          notes: `Registered for ${event.title}.`,
          createdBy: new Types.ObjectId(user.id),
        });
      });
      if (!person)
        return jsonError("Could not allocate a member number. Try again.", 500);

      registration.person = person._id;
      await registration.save();

      await logActivity(
        user,
        "create",
        "person",
        `${person.name} (${person.memberNo})`,
        person._id
      );
      await logActivity(
        user,
        "update",
        "registration",
        `${registration.name} — ${event.title} (added to People)`,
        registration._id
      );

      const stats = await eventStats(user.churchId, id, event.capacity);
      return NextResponse.json({
        registration: serialize(registration.toObject()),
        person: { _id: String(person._id), name: person.name, memberNo: person.memberNo },
        stats,
      });
    }

    if (body.status !== undefined) {
      if (!isRegistrationStatus(body.status)) return jsonError("Invalid status.");
      registration.status = body.status;
    }
    if (body.guests !== undefined) {
      const guests = Number(String(body.guests ?? "0").trim() || 0);
      if (!Number.isInteger(guests) || guests < 0 || guests > 50)
        return jsonError("Guests must be a whole number between 0 and 50.");
      registration.guests = guests;
    }
    if (body.notes !== undefined)
      registration.notes = String(body.notes ?? "").trim().slice(0, 1000);
    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) return jsonError("Name cannot be empty.");
      registration.name = name;
    }
    if (body.phone !== undefined) {
      const phone = String(body.phone ?? "").trim();
      if (phone && !PHONE_RE.test(phone))
        return jsonError("Please enter a valid phone number.");
      registration.phone = phone;
    }
    if (body.email !== undefined) {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (email && !EMAIL_RE.test(email))
        return jsonError("Please enter a valid email address.");
      registration.email = email;
    }

    await registration.save();
    await logActivity(
      user,
      "update",
      "registration",
      `${registration.name} — ${event.title}`,
      registration._id
    );

    const stats = await eventStats(user.churchId, id, event.capacity);
    return NextResponse.json({
      registration: serialize(registration.toObject()),
      stats,
    });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("events");
    const { id, regId } = await params;
    if (!isValidObjectId(id)) return jsonError("Event not found.", 404);
    if (!isValidObjectId(regId)) return jsonError("Registration not found.", 404);

    await connectDb();
    const event = await Event.findOne({ _id: id, churchId: user.churchId })
      .select("title capacity")
      .lean();
    if (!event) return jsonError("Event not found.", 404);
    const registration = await Registration.findOne({
      _id: regId,
      churchId: user.churchId,
      event: id,
    }).lean();
    if (!registration) return jsonError("Registration not found.", 404);

    await moveToRecycleBin({
      user,
      itemType: "registration",
      label: `${registration.name} — ${event.title}`,
      doc: registration,
    });
    await Registration.deleteOne({ _id: regId, churchId: user.churchId });

    const stats = await eventStats(user.churchId, id, event.capacity);
    return NextResponse.json({ ok: true, stats });
  });
}
