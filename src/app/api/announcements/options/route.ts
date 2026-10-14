import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Person } from "@/models/Person";
import { requireChurch, withApi } from "@/lib/api-helpers";
import { PERSON_STATUS_LABELS, PERSON_STATUSES } from "@/lib/constants";

/** Tags, groups and statuses (with counts) — populates the audience pickers. */
export async function GET() {
  return withApi(async () => {
    const user = await requireChurch("announcements");
    await connectDb();
    const churchId = new Types.ObjectId(user.churchId);

    const [tagAgg, statusAgg, groups] = await Promise.all([
      Person.aggregate([
        { $match: { churchId } },
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 100 },
      ]),
      Person.aggregate([
        { $match: { churchId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      // The Group model belongs to the Groups app — read the collection directly.
      mongoose.connection.db
        ? mongoose.connection.db
            .collection("groups")
            .find(
              { churchId, active: { $ne: false } },
              { projection: { name: 1 } }
            )
            .sort({ name: 1 })
            .limit(200)
            .toArray()
        : Promise.resolve([]),
    ]);

    const counts: Record<string, number> = {};
    for (const r of statusAgg) counts[String(r._id)] = r.count as number;

    return NextResponse.json({
      tags: tagAgg.map((t) => String(t._id)),
      groups: groups.map((g) => ({ _id: String(g._id), name: String(g.name ?? "") })),
      statuses: PERSON_STATUSES.map((value) => ({
        value,
        label: PERSON_STATUS_LABELS[value],
        count: counts[value] ?? 0,
      })),
    });
  });
}
