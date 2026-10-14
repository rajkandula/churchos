import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { Person } from "@/models/Person";
import { jsonError, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import type { PersonStatus } from "@/lib/constants";
import { addDaysToKey, dateKey, parseDateKey, todayKey } from "@/lib/attendance-dates";

const ROSTER_STATUSES: PersonStatus[] = ["member", "regular", "visitor"];

/** GET ?service=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD → wall-register grid. */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("attendance");
    const params = req.nextUrl.searchParams;
    const serviceId = (params.get("service") ?? "").trim();
    if (!isValidObjectId(serviceId)) return jsonError("Please choose a service.");

    const to = parseDateKey(params.get("to") || todayKey());
    if (!to) return jsonError("Invalid 'to' date.");
    const from = parseDateKey(params.get("from") || addDaysToKey(dateKey(to), -84));
    if (!from) return jsonError("Invalid 'from' date.");
    if (from > to) return jsonError("'from' must be on or before 'to'.");
    if (to.getTime() - from.getTime() > 400 * 86400000)
      return jsonError("Please choose a range of 400 days or less.");

    await connectDb();
    const docs = await Attendance.find({
      churchId: user.churchId,
      service: serviceId,
      date: { $gte: from, $lte: to },
    })
      .sort({ date: 1 })
      .lean();

    const dates = docs.map((d) => dateKey(d.date));
    const headcounts: Record<string, number> = {};
    for (const d of docs) headcounts[dateKey(d.date)] = d.headcount ?? 0;

    // Rows: everyone marked at least once in the range, plus the current roster
    // so newcomers show up with empty cells rather than vanishing.
    const rows = new Map<
      string,
      { person: string; personName: string; marks: Record<string, boolean | null>; presentCount: number; markedCount: number }
    >();
    const blank = () => Object.fromEntries(dates.map((k) => [k, null])) as Record<string, boolean | null>;

    const roster = await Person.find({
      churchId: user.churchId,
      status: { $in: ROSTER_STATUSES },
    })
      .select("name")
      .lean();
    for (const p of roster) {
      rows.set(String(p._id), {
        person: String(p._id),
        personName: p.name,
        marks: blank(),
        presentCount: 0,
        markedCount: 0,
      });
    }
    for (const d of docs) {
      const key = dateKey(d.date);
      for (const e of d.entries) {
        const id = String(e.person);
        let row = rows.get(id);
        if (!row) {
          row = { person: id, personName: e.personName, marks: blank(), presentCount: 0, markedCount: 0 };
          rows.set(id, row);
        }
        row.marks[key] = Boolean(e.present);
        row.markedCount += 1;
        if (e.present) row.presentCount += 1;
      }
    }

    return NextResponse.json({
      from: dateKey(from),
      to: dateKey(to),
      dates,
      rows: Array.from(rows.values()).sort((a, b) =>
        a.personName.localeCompare(b.personName)
      ),
      headcounts,
    });
  });
}
