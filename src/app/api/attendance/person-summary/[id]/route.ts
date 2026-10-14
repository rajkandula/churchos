import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { jsonError, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";

type Params = { params: Promise<{ id: string }> };

const WINDOW_DAYS = 84;

/** The People profile's attendance card: how often this person was present
 *  across every service they were marked for in the last 12 weeks. */
export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("attendance");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Person not found.", 404);

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - WINDOW_DAYS);

    await connectDb();
    const docs = await Attendance.find({
      churchId: user.churchId,
      date: { $gte: since },
      "entries.person": id,
    })
      .select("date entries")
      .sort({ date: -1 })
      .lean();

    let present = 0;
    let lastPresent: Date | null = null;
    for (const d of docs) {
      const entry = d.entries.find((e) => String(e.person) === id);
      if (entry?.present) {
        present += 1;
        if (!lastPresent || d.date > lastPresent) lastPresent = d.date;
      }
    }
    const total = docs.length;

    return NextResponse.json({
      label: "last 12 weeks",
      present,
      total,
      percent: total ? Math.round((present / total) * 100) : null,
      lastPresent,
    });
  });
}
