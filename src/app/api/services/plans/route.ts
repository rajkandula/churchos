import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { ServicePlan } from "@/models/ServicePlan";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity } from "@/lib/audit";
import {
  parsePlanDate,
  planLabel,
  serializePlan,
  summarizePlan,
} from "@/lib/service-plans";
import { PLAN_STATUSES } from "@/app/dashboard/services/types";

/** Plans in a window — default: the last four weeks plus everything ahead. */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("services");
    const params = req.nextUrl.searchParams;

    const from = parsePlanDate(params.get("from"));
    const to = parsePlanDate(params.get("to"));
    const status = (params.get("status") ?? "").trim();
    if (status && !(PLAN_STATUSES as readonly string[]).includes(status))
      return jsonError("Invalid status.");

    const filter: Record<string, unknown> = { churchId: user.churchId };
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.$gte = from;
    else if (!to) {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - 28);
      dateFilter.$gte = d;
    }
    if (to) {
      const end = new Date(to);
      end.setUTCDate(end.getUTCDate() + 1);
      dateFilter.$lt = end;
    }
    if (Object.keys(dateFilter).length) filter.date = dateFilter;
    if (status) filter.status = status;

    await connectDb();
    const plans = await ServicePlan.find(filter)
      .select("date title theme preacherName status items.durationMin volunteers.person")
      .sort({ date: 1 })
      .limit(500)
      .lean();

    return NextResponse.json({ plans: plans.map(summarizePlan) });
  });
}

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("services");
    const body = await readBody(req);

    const date = parsePlanDate(body.date);
    if (!date) return jsonError("Please choose the service date.");
    const title = String(body.title ?? "").trim() || "Sunday Service";
    const theme = String(body.theme ?? "").trim();
    const copyFrom = String(body.copyFrom ?? "").trim();
    if (copyFrom && !isValidObjectId(copyFrom))
      return jsonError("The plan to copy from was not found.");

    await connectDb();

    // Duplicate the running order + roster from an earlier plan; each slot
    // starts over as "scheduled" so people re-confirm for the new date.
    let items: Record<string, unknown>[] = [];
    let volunteers: Record<string, unknown>[] = [];
    let scripture = "";
    let preacher: Types.ObjectId | null = null;
    let preacherName = "";
    if (copyFrom) {
      const source = await ServicePlan.findOne({
        _id: copyFrom,
        churchId: user.churchId,
      }).lean();
      if (!source) return jsonError("The plan to copy from was not found.");
      items = (source.items ?? []).map((i) => ({
        order: i.order,
        type: i.type,
        title: i.title,
        detail: i.detail,
        owner: i.owner,
        ownerName: i.ownerName,
        durationMin: i.durationMin,
      }));
      volunteers = (source.volunteers ?? []).map((v) => ({
        team: v.team,
        teamName: v.teamName,
        role: v.role,
        person: v.person,
        personName: v.personName,
        status: "scheduled",
      }));
      scripture = source.scripture ?? "";
      preacher = source.preacher ?? null;
      preacherName = source.preacherName ?? "";
    }

    const plan = await ServicePlan.create({
      churchId: user.churchId,
      date,
      title,
      theme,
      scripture,
      preacher,
      preacherName,
      items,
      volunteers,
      status: "draft",
      createdBy: new Types.ObjectId(user.id),
    });

    await logActivity(user, "create", "servicePlan", planLabel(plan), plan._id);
    return NextResponse.json(
      { plan: await serializePlan(user.churchId, plan.toObject()) },
      { status: 201 }
    );
  });
}
