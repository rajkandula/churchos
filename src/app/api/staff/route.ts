import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Staff } from "@/models/Staff";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { buildStaffFilter, pickStaffFields } from "@/lib/staff-fields";
import { seqLabel, withSeqRetry } from "@/lib/seq";
import { logActivity } from "@/lib/audit";
import { STAFF_STATUSES, type StaffStatus } from "@/app/dashboard/staff/types";

/** List staff (q, status, ministry) plus the ministries in use and
 *  status counts for the header — counts ignore the filters. */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("staff");
    await connectDb();
    const churchId = new Types.ObjectId(user.churchId);

    const filter = buildStaffFilter(req.nextUrl.searchParams);
    const [staff, ministries, statusAgg] = await Promise.all([
      Staff.find({ ...filter, churchId: user.churchId }).sort({ name: 1 }).lean(),
      Staff.distinct("ministry", { churchId: user.churchId }),
      Staff.aggregate([
        { $match: { churchId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    // Names of linked People records, so the drawer can show the link
    const personIds = Array.from(
      new Set(staff.map((s) => (s.person ? String(s.person) : "")).filter(Boolean))
    );
    const people = personIds.length
      ? await Person.find({ _id: { $in: personIds }, churchId: user.churchId })
          .select("name memberNo")
          .lean()
      : [];
    const personById = new Map(people.map((p) => [String(p._id), p]));

    const counts: Record<string, number> = {};
    for (const s of STAFF_STATUSES) counts[s] = 0;
    for (const r of statusAgg) counts[String(r._id)] = r.count as number;

    return NextResponse.json({
      staff: staff.map((s) => {
        const linked = s.person ? personById.get(String(s.person)) : undefined;
        return {
          ...s,
          _id: String(s._id),
          person: linked ? String(s.person) : null,
          personName: linked?.name ?? "",
          personMemberNo: linked?.memberNo ?? "",
        };
      }),
      ministries: (ministries as string[])
        .map((m) => String(m ?? "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    });
  });
}

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("staff");
    const body = await readBody(req);

    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("Please enter the staff member's name.");
    const picked = pickStaffFields(body);
    if (!picked.ok) return jsonError(picked.error);
    const data = picked.update;

    await connectDb();
    if (data.person) {
      const p = await Person.findOne({ _id: data.person, churchId: user.churchId })
        .select("_id")
        .lean();
      if (!p) return jsonError("The linked person was not found.");
    }

    const staff = await withSeqRetry(async (attempt) => {
      const seq =
        (await Staff.countDocuments({ churchId: user.churchId })) + 1 + attempt;
      return Staff.create({
        churchId: user.churchId,
        ...data,
        name,
        status: (data.status as StaffStatus | undefined) ?? "active",
        staffNo: seqLabel("S", seq),
        createdBy: new Types.ObjectId(user.id),
      });
    });
    if (!staff) return jsonError("Could not allocate a staff number. Try again.", 500);

    await logActivity(
      user,
      "create",
      "staff",
      `${staff.name} (${staff.staffNo})`,
      staff._id
    );

    return NextResponse.json({ staff }, { status: 201 });
  });
}
