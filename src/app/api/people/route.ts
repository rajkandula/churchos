import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Person } from "@/models/Person";
import { Household } from "@/models/Household";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { canOpen } from "@/lib/access";
import { buildPersonFilter, pickPersonFields } from "@/lib/person-fields";
import { seqLabel, withSeqRetry } from "@/lib/seq";
import { logActivity } from "@/lib/audit";
import { PERSON_STATUSES, type PersonStatus } from "@/lib/constants";

export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch();
    await connectDb();

    const filter = buildPersonFilter(req.nextUrl.searchParams);
    const limit = Math.min(1000, Number(req.nextUrl.searchParams.get("limit")) || 1000);
    const people = await Person.find({ ...filter, churchId: user.churchId })
      .sort({ name: 1 })
      .limit(limit)
      .lean();
    const householdIds = Array.from(
      new Set(people.map((p) => (p.household ? String(p.household) : "")).filter(Boolean))
    );
    const households = householdIds.length
      ? await Household.find({ _id: { $in: householdIds }, churchId: user.churchId })
          .select("name")
          .lean()
      : [];
    const householdName = new Map(households.map((h) => [String(h._id), h.name]));

    // This read is unkeyed so pickers everywhere can look up a name. Roles
    // that can't open People get only what a picker needs — no notes,
    // milestones or documents.
    const full = canOpen(user.access, "people");

    return NextResponse.json({
      people: people.map((p) => {
        const picker = {
          _id: String(p._id),
          memberNo: p.memberNo,
          name: p.name,
          phone: p.phone ?? "",
          email: p.email ?? "",
          photoUrl: p.photoUrl ?? "",
          status: p.status,
          household: p.household ? String(p.household) : null,
          householdName: p.household ? (householdName.get(String(p.household)) ?? "") : "",
        };
        return full ? { ...p, ...picker } : picker;
      }),
    });
  });
}

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("people");
    const body = await readBody(req);

    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("Please enter the person's name.");
    const phone = String(body.phone ?? "").trim();
    if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone))
      return jsonError("Please enter a valid phone number.");
    const email = String(body.email ?? "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return jsonError("Please enter a valid email address.");
    const status = String(body.status ?? "visitor");
    if (!(PERSON_STATUSES as readonly string[]).includes(status))
      return jsonError("Invalid status.");

    await connectDb();
    const data = pickPersonFields(body);

    const person = await withSeqRetry(async (attempt) => {
      const seq =
        (await Person.countDocuments({ churchId: user.churchId })) + 1 + attempt;
      return Person.create({
        churchId: user.churchId,
        ...data,
        memberNo: seqLabel("P", seq),
        status: status as PersonStatus,
        createdBy: new Types.ObjectId(user.id),
      });
    });
    if (!person)
      return jsonError("Could not allocate a member number. Try again.", 500);

    await logActivity(
      user,
      "create",
      "person",
      `${person.name} (${person.memberNo})`,
      person._id
    );

    return NextResponse.json({ person }, { status: 201 });
  });
}
