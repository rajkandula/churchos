import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Person } from "@/models/Person";
import { Household } from "@/models/Household";
import { requireChurch, withApi } from "@/lib/api-helpers";
import { PERSON_STATUSES } from "@/lib/constants";

/** Counts by status, tags in use, and households — drives the People filters. */
export async function GET() {
  return withApi(async () => {
    const user = await requireChurch("people");
    await connectDb();
    const churchId = new Types.ObjectId(user.churchId);

    const [statusAgg, tagAgg, households] = await Promise.all([
      Person.aggregate([
        { $match: { churchId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Person.aggregate([
        { $match: { churchId } },
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 100 },
      ]),
      Household.find({ churchId: user.churchId }).select("name").sort({ name: 1 }).lean(),
    ]);

    const counts: Record<string, number> = {};
    for (const s of PERSON_STATUSES) counts[s] = 0;
    for (const r of statusAgg) counts[String(r._id)] = r.count as number;

    return NextResponse.json({
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      tags: tagAgg.map((t) => ({ tag: String(t._id), count: t.count as number })),
      households: households.map((h) => ({ _id: String(h._id), name: h.name })),
    });
  });
}
