import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Donation } from "@/models/Donation";
import { requireChurch, withApi } from "@/lib/api-helpers";
import { currentYear } from "@/lib/seq";
import { churchCurrency, shapeDonation } from "@/lib/giving";

type Sum = { total: number; count: number };

/** Everything the Giving dashboard strip needs, in one round trip. */
export async function GET() {
  return withApi(async () => {
    const user = await requireChurch("giving");
    await connectDb();

    const churchId = new Types.ObjectId(user.churchId);
    const year = currentYear();
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const monthStart = new Date(Date.UTC(y, m, 1));
    const nextMonthStart = new Date(Date.UTC(y, m + 1, 1));
    const lastMonthStart = new Date(Date.UTC(y, m - 1, 1));

    const sumOf = async (match: Record<string, unknown>): Promise<Sum> => {
      const rows = await Donation.aggregate<{ total: number; count: number }>([
        { $match: { churchId, ...match } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]);
      return { total: rows[0]?.total ?? 0, count: rows[0]?.count ?? 0 };
    };

    const [currency, thisMonth, lastMonth, thisYear, byFundRows, byMonthRows, topRows, recent] =
      await Promise.all([
        churchCurrency(user.churchId),
        sumOf({ date: { $gte: monthStart, $lt: nextMonthStart } }),
        sumOf({ date: { $gte: lastMonthStart, $lt: monthStart } }),
        sumOf({ year }),
        Donation.aggregate<{ _id: Types.ObjectId; fundName: string; total: number }>([
          { $match: { churchId, year } },
          {
            $group: {
              _id: "$fund",
              fundName: { $last: "$fundName" },
              total: { $sum: "$amount" },
            },
          },
          { $sort: { total: -1 } },
        ]),
        Donation.aggregate<{ _id: string; total: number }>([
          { $match: { churchId, year } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
              total: { $sum: "$amount" },
            },
          },
        ]),
        Donation.aggregate<{ _id: Types.ObjectId; personName: string; total: number }>([
          { $match: { churchId, year, person: { $ne: null } } },
          {
            $group: {
              _id: "$person",
              personName: { $last: "$personName" },
              total: { $sum: "$amount" },
            },
          },
          { $sort: { total: -1 } },
          { $limit: 10 },
        ]),
        Donation.find({ churchId }).sort({ date: -1, createdAt: -1 }).limit(8).lean(),
      ]);

    const monthTotals = new Map(byMonthRows.map((r) => [r._id, r.total]));
    const byMonth = Array.from({ length: 12 }, (_, i) => {
      const month = `${year}-${String(i + 1).padStart(2, "0")}`;
      return { month, total: monthTotals.get(month) ?? 0 };
    });

    return NextResponse.json({
      year,
      currency,
      thisMonth,
      thisYear,
      lastMonth: { total: lastMonth.total },
      byFund: byFundRows.map((r) => ({
        fundId: String(r._id),
        fundName: r.fundName,
        total: r.total,
      })),
      byMonth,
      topGivers: topRows.map((r) => ({
        person: String(r._id),
        personName: r.personName,
        total: r.total,
      })),
      recentDonations: recent.map(shapeDonation),
    });
  });
}
