import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Donation } from "@/models/Donation";
import { requireChurch, withApi } from "@/lib/api-helpers";
import { currentYear } from "@/lib/seq";

/** Everyone (linked to a Person) who gave in a year, with their totals —
 *  the Statements tab's "who needs a statement" list. */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    const yearParam = (req.nextUrl.searchParams.get("year") ?? "").trim();
    const year = /^\d{4}$/.test(yearParam) ? yearParam : currentYear();

    await connectDb();
    const rows = await Donation.aggregate<{
      _id: Types.ObjectId;
      personName: string;
      total: number;
      count: number;
      lastDate: Date;
    }>([
      {
        $match: {
          churchId: new Types.ObjectId(user.churchId),
          year,
          person: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$person",
          personName: { $last: "$personName" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
          lastDate: { $max: "$date" },
        },
      },
      { $sort: { total: -1 } },
    ]);

    return NextResponse.json({
      year,
      givers: rows.map((r) => ({
        person: String(r._id),
        personName: r.personName,
        total: r.total,
        count: r.count,
        lastDate: r.lastDate,
      })),
    });
  });
}
