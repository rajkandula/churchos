import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { Service } from "@/models/Service";
import { Person } from "@/models/Person";
import { Household } from "@/models/Household";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import type { PersonStatus } from "@/lib/constants";
import { dateKey, parseDateKey } from "@/lib/attendance-dates";
import { logActivity } from "@/lib/audit";

/** Statuses that appear on the roster to be marked. */
const ROSTER_STATUSES: PersonStatus[] = ["member", "regular", "visitor"];

function shape(a: {
  _id: unknown;
  service: unknown;
  serviceName: string;
  date: Date;
  headcount?: number | null;
  adults?: number | null;
  children?: number | null;
  entries: { person: unknown; personName: string; present: boolean }[];
  note?: string | null;
  markedBy?: unknown;
  markedByName?: string | null;
  updatedAt?: Date;
}) {
  return {
    _id: String(a._id),
    service: String(a.service),
    serviceName: a.serviceName,
    date: dateKey(a.date),
    headcount: a.headcount ?? 0,
    adults: a.adults ?? null,
    children: a.children ?? null,
    entries: a.entries.map((e) => ({
      person: String(e.person),
      personName: e.personName,
      present: Boolean(e.present),
    })),
    note: a.note ?? "",
    markedBy: a.markedBy ? String(a.markedBy) : null,
    markedByName: a.markedByName ?? "",
    updatedAt: a.updatedAt ?? null,
  };
}

/** GET ?service=<id>&date=YYYY-MM-DD → the day's record plus the roster to mark. */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("attendance");
    const serviceId = (req.nextUrl.searchParams.get("service") ?? "").trim();
    if (!isValidObjectId(serviceId)) return jsonError("Please choose a service.");
    const date = parseDateKey(req.nextUrl.searchParams.get("date"));
    if (!date) return jsonError("Please choose a date (YYYY-MM-DD).");

    await connectDb();
    const service = await Service.findOne({
      _id: serviceId,
      churchId: user.churchId,
    }).lean();
    if (!service) return jsonError("Service not found.", 404);

    const attendance = await Attendance.findOne({
      churchId: user.churchId,
      service: serviceId,
      date,
    }).lean();

    const roster = await Person.find({
      churchId: user.churchId,
      status: { $in: ROSTER_STATUSES },
    })
      .select("name memberNo photoUrl household")
      .sort({ name: 1 })
      .lean();

    // Keep anyone already marked on this day even if they since left the roster,
    // so re-saving never silently drops their mark.
    const rosterIds = new Set(roster.map((p) => String(p._id)));
    const extraIds = (attendance?.entries ?? [])
      .map((e) => String(e.person))
      .filter((id) => !rosterIds.has(id));
    const extras = extraIds.length
      ? await Person.find({ _id: { $in: extraIds }, churchId: user.churchId })
          .select("name memberNo photoUrl household")
          .sort({ name: 1 })
          .lean()
      : [];

    const all = [...roster, ...extras];
    const householdIds = Array.from(
      new Set(all.map((p) => (p.household ? String(p.household) : "")).filter(Boolean))
    );
    const households = householdIds.length
      ? await Household.find({ _id: { $in: householdIds }, churchId: user.churchId })
          .select("name")
          .lean()
      : [];
    const householdName = new Map(households.map((h) => [String(h._id), h.name]));
    const marks = new Map(
      (attendance?.entries ?? []).map((e) => [String(e.person), Boolean(e.present)])
    );

    return NextResponse.json({
      attendance: attendance ? shape(attendance) : null,
      people: all.map((p) => ({
        _id: String(p._id),
        name: p.name,
        memberNo: p.memberNo,
        photoUrl: p.photoUrl ?? "",
        householdName: p.household ? (householdName.get(String(p.household)) ?? "") : "",
        present: marks.get(String(p._id)) ?? false,
      })),
    });
  });
}

function optionalCount(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

/** PUT/POST { service, date, headcount, adults, children, entries, note } → upsert the day. */
async function save(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("attendance");
    const body = await readBody(req);

    const serviceId = String(body.service ?? "").trim();
    if (!isValidObjectId(serviceId)) return jsonError("Please choose a service.");
    const date = parseDateKey(body.date);
    if (!date) return jsonError("Please choose a date (YYYY-MM-DD).");
    if (body.headcount !== undefined && body.headcount !== null && body.headcount !== "") {
      const n = Number(body.headcount);
      if (!Number.isFinite(n) || n < 0) return jsonError("Headcount must be 0 or more.");
    }
    const adults = optionalCount(body.adults);
    const children = optionalCount(body.children);
    if (body.adults !== undefined && adults === undefined)
      return jsonError("Adults must be 0 or more.");
    if (body.children !== undefined && children === undefined)
      return jsonError("Children must be 0 or more.");
    const note = String(body.note ?? "").trim().slice(0, 1000);

    const rawEntries: unknown[] = Array.isArray(body.entries) ? body.entries : [];
    const wanted = new Map<string, boolean>();
    for (const e of rawEntries) {
      if (!e || typeof e !== "object") continue;
      const id = String((e as { person?: unknown }).person ?? "").trim();
      if (!isValidObjectId(id)) continue;
      wanted.set(id, Boolean((e as { present?: unknown }).present));
    }

    await connectDb();
    const service = await Service.findOne({
      _id: serviceId,
      churchId: user.churchId,
    }).lean();
    if (!service) return jsonError("Service not found.", 404);

    // Snapshot names from the People register — only this church's people count
    const people = wanted.size
      ? await Person.find({
          _id: { $in: Array.from(wanted.keys()) },
          churchId: user.churchId,
        })
          .select("name")
          .lean()
      : [];
    const entries = people
      .map((p) => ({
        person: p._id,
        personName: p.name,
        present: wanted.get(String(p._id)) ?? false,
      }))
      .sort((a, b) => a.personName.localeCompare(b.personName));
    const presentCount = entries.filter((e) => e.present).length;

    const headcount =
      body.headcount === undefined || body.headcount === null || body.headcount === ""
        ? presentCount
        : Math.round(Number(body.headcount));

    const existing = await Attendance.findOne({
      churchId: user.churchId,
      service: serviceId,
      date,
    })
      .select("_id")
      .lean();

    const set: Record<string, unknown> = {
      serviceName: service.name,
      headcount,
      entries,
      note,
      markedBy: new Types.ObjectId(user.id),
      markedByName: user.name,
    };
    if (adults !== undefined) set.adults = adults;
    if (children !== undefined) set.children = children;

    const attendance = await Attendance.findOneAndUpdate(
      { churchId: user.churchId, service: serviceId, date },
      // The equality filter fields (churchId, service, date) are copied onto
      // the document when the upsert inserts.
      { $set: set },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    if (!attendance) return jsonError("Could not save attendance.", 500);

    await logActivity(
      user,
      existing ? "update" : "create",
      "attendance",
      `${service.name} — ${dateKey(date)} (${presentCount} present, headcount ${headcount})`,
      attendance._id
    );

    return NextResponse.json({ attendance: shape(attendance) });
  });
}

export async function PUT(req: NextRequest) {
  return save(req);
}

export async function POST(req: NextRequest) {
  return save(req);
}
