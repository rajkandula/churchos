import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { randomInt } from "node:crypto";
import { connectDb } from "@/lib/db";
import { CheckIn } from "@/models/CheckIn";
import { Service } from "@/models/Service";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { ageOn, parseDateKey, todayKey } from "@/lib/attendance-dates";
import { withSeqRetry } from "@/lib/seq";
import { logActivity } from "@/lib/audit";
import { shapeCheckIn } from "./shape";

// No 0/O or 1/I — the code is read aloud at pick-up
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 4; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/** GET ?date=YYYY-MM-DD (default today) → that day's check-ins, newest first. */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("attendance");
    const date = parseDateKey(req.nextUrl.searchParams.get("date") || todayKey());
    if (!date) return jsonError("Invalid date (YYYY-MM-DD).");

    await connectDb();
    const checkIns = await CheckIn.find({ churchId: user.churchId, date })
      .sort({ checkedInAt: -1 })
      .lean();
    return NextResponse.json({ checkIns: checkIns.map(shapeCheckIn) });
  });
}

/** POST { person, service?, date?, guardianName, guardianPhone, room, notes, allergies } */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("attendance");
    const body = await readBody(req);

    const personId = String(body.person ?? "").trim();
    if (!isValidObjectId(personId)) return jsonError("Please choose the child.");
    const serviceId = String(body.service ?? "").trim();
    if (serviceId && !isValidObjectId(serviceId)) return jsonError("Service not found.", 404);
    const date = parseDateKey(body.date || todayKey());
    if (!date) return jsonError("Invalid date (YYYY-MM-DD).");
    const guardianName = String(body.guardianName ?? "").trim().slice(0, 120);
    const guardianPhone = String(body.guardianPhone ?? "").trim();
    if (!guardianPhone) return jsonError("Please enter the guardian's phone number.");
    if (!/^[0-9+\-\s()]{6,20}$/.test(guardianPhone))
      return jsonError("Please enter a valid guardian phone number.");
    const room = String(body.room ?? "").trim().slice(0, 60);
    const notes = String(body.notes ?? "").trim().slice(0, 500);
    const allergies = String(body.allergies ?? "").trim().slice(0, 300);

    await connectDb();
    const person = await Person.findOne({ _id: personId, churchId: user.churchId })
      .select("name dob")
      .lean();
    if (!person) return jsonError("Person not found.", 404);
    const service = serviceId
      ? await Service.findOne({ _id: serviceId, churchId: user.churchId })
          .select("name")
          .lean()
      : null;
    if (serviceId && !service) return jsonError("Service not found.", 404);

    const age = ageOn(person.dob, date);
    const checkIn = await withSeqRetry(() =>
      CheckIn.create({
        churchId: user.churchId,
        date,
        service: service ? service._id : null,
        serviceName: service?.name ?? "",
        person: person._id,
        personName: person.name,
        ...(age !== null ? { age } : {}),
        guardianName,
        guardianPhone,
        securityCode: randomCode(),
        room,
        checkedInAt: new Date(),
        checkedOutAt: null,
        checkedInBy: new Types.ObjectId(user.id),
        notes,
        allergies,
      })
    );
    if (!checkIn) return jsonError("Could not allocate a security code. Try again.", 500);

    await logActivity(
      user,
      "create",
      "checkIn",
      `${person.name}${room ? ` → ${room}` : ""} (${checkIn.securityCode})`,
      checkIn._id
    );
    return NextResponse.json({ checkIn: shapeCheckIn(checkIn.toObject()) }, { status: 201 });
  });
}
