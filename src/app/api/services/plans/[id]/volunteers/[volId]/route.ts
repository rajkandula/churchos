import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ServicePlan } from "@/models/ServicePlan";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity } from "@/lib/audit";
import { planLabel } from "@/lib/service-plans";
import { VOLUNTEER_STATUSES } from "@/app/dashboard/services/types";

type Params = { params: Promise<{ id: string; volId: string }> };

/** Confirm / decline one volunteer slot. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("services");
    const { id, volId } = await params;
    if (!isValidObjectId(id) || !isValidObjectId(volId))
      return jsonError("Volunteer slot not found.", 404);
    const body = await readBody(req);
    const status = String(body.status ?? "");
    if (!(VOLUNTEER_STATUSES as readonly string[]).includes(status))
      return jsonError("Status must be scheduled, confirmed or declined.");

    await connectDb();
    const plan = await ServicePlan.findOneAndUpdate(
      { _id: id, churchId: user.churchId, "volunteers._id": volId },
      { $set: { "volunteers.$.status": status } },
      { new: true }
    ).lean();
    if (!plan) return jsonError("Volunteer slot not found.", 404);

    const slot = (plan.volunteers ?? []).find((v) => String(v._id) === volId);
    if (!slot) return jsonError("Volunteer slot not found.", 404);

    await logActivity(
      user,
      "update",
      "servicePlan",
      `${planLabel(plan)} · ${slot.personName || slot.role} ${status}`,
      id
    );
    return NextResponse.json({
      volunteer: {
        _id: String(slot._id),
        team: String(slot.team),
        teamName: slot.teamName ?? "",
        role: slot.role ?? "",
        person: slot.person ? String(slot.person) : null,
        personName: slot.personName ?? "",
        status: slot.status,
      },
    });
  });
}
