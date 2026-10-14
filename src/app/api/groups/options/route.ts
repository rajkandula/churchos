import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Group } from "@/models/Group";
import { requireChurch, withApi } from "@/lib/api-helpers";
import { GROUP_TYPES } from "@/app/dashboard/groups/types";

/** GET → { types: [{ type, count }], total, totalMembers }
 *  Counts cover active groups; totalMembers is the number of distinct people
 *  who belong to (or lead) any active group. */
export async function GET() {
  return withApi(async () => {
    const user = await requireChurch("groups");
    await connectDb();
    const churchId = new Types.ObjectId(user.churchId);

    const [typeAgg, groups] = await Promise.all([
      Group.aggregate([
        { $match: { churchId, active: true } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      Group.find({ churchId: user.churchId, active: true })
        .select("leader coLeaders.person members.person")
        .lean(),
    ]);

    const counts: Record<string, number> = {};
    for (const t of GROUP_TYPES) counts[t] = 0;
    for (const r of typeAgg) counts[String(r._id)] = r.count as number;

    const people = new Set<string>();
    for (const g of groups) {
      if (g.leader) people.add(String(g.leader));
      for (const c of g.coLeaders ?? []) people.add(String(c.person));
      for (const m of g.members ?? []) people.add(String(m.person));
    }

    return NextResponse.json({
      types: GROUP_TYPES.map((type) => ({ type, count: counts[type] ?? 0 })),
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      totalMembers: people.size,
    });
  });
}
