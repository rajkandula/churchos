import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Household } from "@/models/Household";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity } from "@/lib/audit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pickHouseholdFields(body: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ["name", "phone", "email", "address", "city", "state", "pincode", "notes"] as const) {
    if (body[key] !== undefined) {
      const v = String(body[key] ?? "").trim();
      out[key] = key === "email" ? v.toLowerCase() : v;
    }
  }
  if (body.anniversary !== undefined) {
    const v = String(body.anniversary ?? "").trim();
    out.anniversary = v ? new Date(v) : null;
  }
  if (body.head !== undefined) {
    const v = String(body.head ?? "").trim();
    out.head = v && isValidObjectId(v) ? v : null;
  }
  return out;
}

export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("people");
    await connectDb();
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const filter: Record<string, unknown> = { churchId: user.churchId };
    if (q) filter.name = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const [households, memberAgg] = await Promise.all([
      Household.find(filter).sort({ name: 1 }).lean(),
      Person.aggregate([
        { $match: { churchId: new Types.ObjectId(user.churchId), household: { $ne: null } } },
        { $group: { _id: "$household", count: { $sum: 1 }, names: { $push: "$name" } } },
      ]),
    ]);
    const byId = new Map(memberAgg.map((r) => [String(r._id), r]));
    const headIds = households.map((h) => h.head).filter(Boolean);
    const heads = headIds.length
      ? await Person.find({ _id: { $in: headIds }, churchId: user.churchId }).select("name").lean()
      : [];
    const headName = new Map(heads.map((p) => [String(p._id), p.name]));

    return NextResponse.json({
      households: households.map((h) => {
        const agg = byId.get(String(h._id));
        return {
          ...h,
          _id: String(h._id),
          head: h.head ? String(h.head) : null,
          headName: h.head ? (headName.get(String(h.head)) ?? "") : "",
          memberCount: agg?.count ?? 0,
          memberNames: ((agg?.names as string[]) ?? []).slice(0, 6),
        };
      }),
    });
  });
}

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("people");
    const body = await readBody(req);
    const data = pickHouseholdFields(body);
    if (!data.name) return jsonError("Please enter the household name.");

    await connectDb();
    const household = await Household.create({
      churchId: user.churchId,
      ...data,
      createdBy: new Types.ObjectId(user.id),
    });
    // Optionally attach members straight away
    if (Array.isArray(body.memberIds) && body.memberIds.length) {
      const ids = body.memberIds.filter((x: unknown) => isValidObjectId(String(x)));
      await Person.updateMany(
        { _id: { $in: ids }, churchId: user.churchId },
        { $set: { household: household._id } }
      );
    }
    await logActivity(user, "create", "household", household.name, household._id);
    return NextResponse.json({ household }, { status: 201 });
  });
}
