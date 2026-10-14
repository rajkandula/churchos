import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { jsonError, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { dateKey } from "@/lib/attendance-dates";

/** GET ?service=<id>&weeks=12 → [{ date, headcount, present }] oldest first.
 *  Omit `service` to get every service's records (each row carries serviceName). */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("attendance");
    const params = req.nextUrl.searchParams;
    const serviceId = (params.get("service") ?? "").trim();
    if (serviceId && !isValidObjectId(serviceId)) return jsonError("Service not found.", 404);
    const weeks = Math.min(104, Math.max(1, Number(params.get("weeks")) || 12));
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - weeks * 7);

    await connectDb();
    const filter: Record<string, unknown> = {
      churchId: user.churchId,
      date: { $gte: since },
    };
    if (serviceId) filter.service = serviceId;
    const docs = await Attendance.find(filter)
      .select("date headcount entries.present service serviceName")
      .sort({ date: 1 })
      .lean();

    return NextResponse.json(
      docs.map((d) => ({
        date: dateKey(d.date),
        service: String(d.service),
        serviceName: d.serviceName,
        headcount: d.headcount ?? 0,
        present: d.entries.filter((e) => e.present).length,
      }))
    );
  });
}
