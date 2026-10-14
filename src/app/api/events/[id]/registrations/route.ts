import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Event } from "@/models/Event";
import { Registration } from "@/models/Registration";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity } from "@/lib/audit";
import {
  EMAIL_RE,
  PHONE_RE,
  eventStats,
  findDuplicateRegistration,
  isRegistrationStatus,
} from "@/lib/events";
import type { RegistrationStatus } from "@/app/dashboard/events/types";

type Params = { params: Promise<{ id: string }> };

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

export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("events");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Event not found.", 404);

    await connectDb();
    const event = await Event.findOne({ _id: id, churchId: user.churchId })
      .select("capacity")
      .lean();
    if (!event) return jsonError("Event not found.", 404);

    const registrations = await Registration.find({
      churchId: user.churchId,
      event: id,
    })
      .sort({ registeredAt: -1 })
      .lean();
    const stats = await eventStats(user.churchId, id, event.capacity);

    return NextResponse.json({
      registrations: registrations.map(serialize),
      stats,
    });
  });
}

/** Admin adds a signup — either a picked Person or free text. */
export async function POST(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("events");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Event not found.", 404);
    const body = await readBody(req);

    let personId: string | null = null;
    let name = String(body.name ?? "").trim();
    let phone = String(body.phone ?? "").trim();
    let email = String(body.email ?? "").trim().toLowerCase();
    const guests = Number(String(body.guests ?? "0").trim() || 0);
    const notes = String(body.notes ?? "").trim().slice(0, 1000);
    const status = String(body.status ?? "registered");

    if (!Number.isInteger(guests) || guests < 0 || guests > 50)
      return jsonError("Guests must be a whole number between 0 and 50.");
    if (!isRegistrationStatus(status)) return jsonError("Invalid status.");

    await connectDb();
    const event = await Event.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!event) return jsonError("Event not found.", 404);

    const pickedPerson = String(body.person ?? "").trim();
    if (pickedPerson) {
      if (!isValidObjectId(pickedPerson)) return jsonError("Person not found.");
      const person = await Person.findOne({ _id: pickedPerson, churchId: user.churchId })
        .select("name phone email")
        .lean();
      if (!person) return jsonError("Person not found.");
      personId = String(person._id);
      // Snapshot so the registration reads the same even if the profile changes
      name = name || person.name;
      phone = phone || person.phone || "";
      email = email || person.email || "";
    }

    if (!name) return jsonError("Please enter the registrant's name.");
    if (phone && !PHONE_RE.test(phone))
      return jsonError("Please enter a valid phone number.");
    if (email && !EMAIL_RE.test(email))
      return jsonError("Please enter a valid email address.");

    if (personId) {
      const existing = await Registration.findOne({
        churchId: user.churchId,
        event: id,
        person: personId,
        status: { $ne: "cancelled" },
      }).lean();
      if (existing) return jsonError(`${name} is already registered for this event.`, 409);
    } else {
      const dup = await findDuplicateRegistration(user.churchId, id, phone, email);
      if (dup) return jsonError(`${dup.name} is already registered with that phone or email.`, 409);
    }

    const registration = await Registration.create({
      churchId: user.churchId,
      event: id,
      person: personId,
      name,
      phone,
      email,
      guests,
      notes,
      status: status as RegistrationStatus,
      source: "admin",
      registeredAt: new Date(),
    });

    await logActivity(
      user,
      "create",
      "registration",
      `${name} — ${event.title}`,
      registration._id
    );

    const stats = await eventStats(user.churchId, id, event.capacity);
    return NextResponse.json(
      { registration: serialize(registration.toObject()), stats },
      { status: 201 }
    );
  });
}
