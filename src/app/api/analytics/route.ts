import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Person } from "@/models/Person";
import { Church } from "@/models/Church";
import { requireChurch, withApi } from "@/lib/api-helpers";
import { PERSON_STATUSES } from "@/lib/constants";

/**
 * One sweep over every app — the numbers a pastor checks on Monday morning.
 * Other apps' collections are read through the raw driver so this route
 * never fails just because a collection hasn't been created yet.
 */
export async function GET() {
  return withApi(async () => {
    const user = await requireChurch("analytics");
    await connectDb();
    const churchId = new Types.ObjectId(user.churchId);
    const db = mongoose.connection.db!;
    const col = (name: string) => db.collection(name);
    const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await p;
      } catch {
        return fallback;
      }
    };

    const now = new Date();
    const year = String(now.getFullYear());
    const yearStart = new Date(Date.UTC(now.getFullYear(), 0, 1));
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const lastMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
    const d30 = new Date(Date.now() - 30 * 864e5);
    const d84 = new Date(Date.now() - 84 * 864e5);
    const d7 = new Date(Date.now() + 7 * 864e5);

    const church = await Church.findById(churchId).select("currency name").lean();
    const currency = church?.currency ?? "INR";

    // ── People ─────────────────────────────────
    const statusAgg = await Person.aggregate([
      { $match: { churchId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const byStatus: Record<string, number> = {};
    for (const s of PERSON_STATUSES) byStatus[s] = 0;
    for (const r of statusAgg) byStatus[String(r._id)] = r.count as number;
    const totalPeople = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const newPeople30 = await Person.countDocuments({ churchId, createdAt: { $gte: d30 } });
    const genderAgg = await Person.aggregate([
      { $match: { churchId, gender: { $ne: "" } } },
      { $group: { _id: "$gender", count: { $sum: 1 } } },
    ]);
    const households = await safe(col("households").countDocuments({ churchId }), 0);

    // Birthdays in the next 7 days (month/day match, any year)
    const people = await Person.find({ churchId, dob: { $ne: null }, status: { $nin: ["deceased", "transferred"] } })
      .select("name dob photoUrl")
      .lean();
    const inWindow = (d: Date) => {
      const thisYear = new Date(Date.UTC(now.getFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const nextYear = new Date(Date.UTC(now.getFullYear() + 1, d.getUTCMonth(), d.getUTCDate()));
      const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const cand = thisYear >= today ? thisYear : nextYear;
      return cand <= d7 ? cand : null;
    };
    const birthdays = people
      .map((p) => ({ _id: String(p._id), name: p.name, photoUrl: p.photoUrl ?? "", on: inWindow(new Date(p.dob as Date)) }))
      .filter((b) => b.on)
      .sort((a, b) => (a.on as Date).getTime() - (b.on as Date).getTime())
      .slice(0, 12);

    // ── Giving ─────────────────────────────────
    const sum = (match: Record<string, unknown>) =>
      safe(
        col("donations")
          .aggregate([{ $match: { churchId, ...match } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }])
          .toArray()
          .then((r) => ({ total: (r[0]?.total as number) ?? 0, count: (r[0]?.count as number) ?? 0 })),
        { total: 0, count: 0 }
      );
    const [givingYear, givingMonth, givingLastMonth] = await Promise.all([
      sum({ date: { $gte: yearStart } }),
      sum({ date: { $gte: monthStart } }),
      sum({ date: { $gte: lastMonthStart, $lt: monthStart } }),
    ]);
    const byMonthAgg = await safe(
      col("donations")
        .aggregate([
          { $match: { churchId, date: { $gte: yearStart } } },
          { $group: { _id: { $month: "$date" }, total: { $sum: "$amount" } } },
        ])
        .toArray(),
      [] as { _id: number; total: number }[]
    );
    const givingByMonth = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(Date.UTC(2000, i, 1)).toLocaleString("en", { month: "short", timeZone: "UTC" }),
      total: (byMonthAgg.find((r) => Number(r._id) === i + 1)?.total as number) ?? 0,
    }));
    const byFund = await safe(
      col("donations")
        .aggregate([
          { $match: { churchId, date: { $gte: yearStart } } },
          { $group: { _id: "$fundName", total: { $sum: "$amount" } } },
          { $sort: { total: -1 } },
          { $limit: 6 },
        ])
        .toArray()
        .then((r) => r.map((x) => ({ fundName: String(x._id ?? "—"), total: x.total as number }))),
      [] as { fundName: string; total: number }[]
    );
    const givers = await safe(
      col("donations").distinct("person", { churchId, date: { $gte: yearStart }, person: { $ne: null } }).then((r) => r.length),
      0
    );

    // ── Attendance ─────────────────────────────
    const attendanceRows = await safe(
      col("attendances")
        .find({ churchId, date: { $gte: d84 } })
        .project({ date: 1, headcount: 1, serviceName: 1, entries: 1 })
        .sort({ date: 1 })
        .toArray(),
      [] as Record<string, unknown>[]
    );
    const trend = attendanceRows.map((r) => ({
      date: (r.date as Date).toISOString().slice(0, 10),
      serviceName: String(r.serviceName ?? ""),
      headcount:
        (r.headcount as number) ||
        ((r.entries as { present?: boolean }[] | undefined)?.filter((e) => e.present).length ?? 0),
    }));
    const avgHeadcount = trend.length
      ? Math.round(trend.reduce((s, t) => s + t.headcount, 0) / trend.length)
      : null;
    const lastAttendance = trend[trend.length - 1] ?? null;
    const checkinsToday = await safe(
      col("checkins").countDocuments({ churchId, date: { $gte: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) } }),
      0
    );

    // ── Groups / events / connect / services ───
    const groups = await safe(col("groups").countDocuments({ churchId, active: { $ne: false } }), 0);
    const inGroups = await safe(
      col("groups").distinct("members.person", { churchId, active: { $ne: false } }).then((r) => r.length),
      0
    );
    const upcomingEvents = await safe(
      col("events")
        .find({ churchId, startAt: { $gte: now }, status: { $nin: ["cancelled", "draft"] } })
        .project({ title: 1, startAt: 1, venue: 1, capacity: 1 })
        .sort({ startAt: 1 })
        .limit(5)
        .toArray(),
      [] as Record<string, unknown>[]
    );
    const eventIds = upcomingEvents.map((e) => e._id);
    const regAgg = eventIds.length
      ? await safe(
          col("registrations")
            .aggregate([
              { $match: { churchId, event: { $in: eventIds }, status: { $in: ["registered", "attended"] } } },
              { $group: { _id: "$event", n: { $sum: { $add: [1, { $ifNull: ["$guests", 0] }] } } } },
            ])
            .toArray(),
          [] as { _id: unknown; n: number }[]
        )
      : [];
    const regMap = new Map(regAgg.map((r) => [String(r._id), r.n as number]));
    const events = upcomingEvents.map((e) => ({
      _id: String(e._id),
      title: String(e.title),
      startAt: e.startAt as Date,
      venue: String(e.venue ?? ""),
      capacity: (e.capacity as number) ?? null,
      registered: regMap.get(String(e._id)) ?? 0,
    }));
    const connectAgg = await safe(
      col("connectcards")
        .aggregate([{ $match: { churchId } }, { $group: { _id: "$status", n: { $sum: 1 } } }])
        .toArray(),
      [] as { _id: string; n: number }[]
    );
    const connect: Record<string, number> = { new: 0, contacted: 0, "visited-again": 0, joined: 0, closed: 0 };
    for (const r of connectAgg) connect[String(r._id)] = r.n as number;
    const connectThisMonth = await safe(col("connectcards").countDocuments({ churchId, createdAt: { $gte: monthStart } }), 0);

    const nextPlan = await safe(
      col("serviceplans")
        .find({ churchId, date: { $gte: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) } })
        .project({ date: 1, title: 1, theme: 1, preacherName: 1, items: 1, volunteers: 1, status: 1 })
        .sort({ date: 1 })
        .limit(1)
        .next(),
      null as Record<string, unknown> | null
    );
    const services = nextPlan
      ? {
          _id: String(nextPlan._id),
          date: nextPlan.date as Date,
          title: String(nextPlan.title ?? ""),
          theme: String(nextPlan.theme ?? ""),
          preacherName: String(nextPlan.preacherName ?? ""),
          items: ((nextPlan.items as unknown[]) ?? []).length,
          volunteers: ((nextPlan.volunteers as { status?: string }[]) ?? []).length,
          confirmed: ((nextPlan.volunteers as { status?: string }[]) ?? []).filter((v) => v.status === "confirmed").length,
          status: String(nextPlan.status ?? "draft"),
        }
      : null;

    const [announcements, certificates, staff] = await Promise.all([
      safe(col("announcements").countDocuments({ churchId, createdAt: { $gte: yearStart } }), 0),
      safe(col("certificates").countDocuments({ churchId, createdAt: { $gte: yearStart } }), 0),
      safe(col("staffs").countDocuments({ churchId, status: "active" }), 0),
    ]);

    return NextResponse.json({
      year,
      currency,
      churchName: church?.name ?? "",
      people: {
        total: totalPeople,
        byStatus,
        newLast30: newPeople30,
        households,
        genders: Object.fromEntries(genderAgg.map((g) => [String(g._id), g.count as number])),
        birthdays,
      },
      giving: {
        thisYear: givingYear,
        thisMonth: givingMonth,
        lastMonth: givingLastMonth,
        byMonth: givingByMonth,
        byFund,
        givers,
      },
      attendance: { trend, avgHeadcount, last: lastAttendance, checkinsToday },
      groups: { active: groups, peopleInGroups: inGroups },
      events,
      connect: { byStatus: connect, thisMonth: connectThisMonth },
      services,
      activity: { announcements, certificates, staff },
    });
  });
}
