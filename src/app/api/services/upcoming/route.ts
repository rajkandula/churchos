import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ServicePlan } from "@/models/ServicePlan";
import { requireChurch, withApi } from "@/lib/api-helpers";
import { serializePlan } from "@/lib/service-plans";
import type { PlanVolunteerDto } from "@/app/dashboard/services/types";

/** The next service (today or later) with its roster grouped by team —
 *  for the dashboard tile and analytics. `plan` is null when nothing is planned. */
export async function GET() {
  return withApi(async () => {
    const user = await requireChurch("services");
    await connectDb();

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const doc = await ServicePlan.findOne({
      churchId: user.churchId,
      date: { $gte: today },
    })
      .sort({ date: 1 })
      .lean();
    if (!doc) return NextResponse.json({ plan: null, teams: [] });

    const plan = await serializePlan(user.churchId, doc);
    const byTeam = new Map<string, { team: string; teamName: string; volunteers: PlanVolunteerDto[] }>();
    for (const v of plan.volunteers) {
      const key = v.team;
      if (!byTeam.has(key)) byTeam.set(key, { team: key, teamName: v.teamName, volunteers: [] });
      byTeam.get(key)!.volunteers.push(v);
    }
    const teams = Array.from(byTeam.values()).sort((a, b) =>
      a.teamName.localeCompare(b.teamName)
    );
    const filled = plan.volunteers.filter((v) => v.person);

    return NextResponse.json({
      plan: {
        _id: plan._id,
        date: plan.date,
        title: plan.title,
        theme: plan.theme,
        scripture: plan.scripture,
        preacherName: plan.preacherName,
        status: plan.status,
        itemCount: plan.items.length,
        totalDurationMin: plan.items.reduce((s, i) => s + i.durationMin, 0),
        volunteerCount: filled.length,
        confirmedCount: filled.filter((v) => v.status === "confirmed").length,
        declinedCount: filled.filter((v) => v.status === "declined").length,
      },
      teams,
    });
  });
}
