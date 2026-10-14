import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ServicePlan } from "@/models/ServicePlan";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";
import {
  buildItems,
  buildVolunteers,
  parsePlanDate,
  planLabel,
  serializePlan,
} from "@/lib/service-plans";
import { PLAN_STATUSES } from "@/app/dashboard/services/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("services");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Service plan not found.", 404);
    await connectDb();
    const plan = await ServicePlan.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!plan) return jsonError("Service plan not found.", 404);
    return NextResponse.json({ plan: await serializePlan(user.churchId, plan) });
  });
}

/** Scalar fields, or a full `items` / `volunteers` replacement — the editor
 *  autosaves whichever section changed. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("services");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Service plan not found.", 404);
    const body = await readBody(req);

    const update: Record<string, unknown> = {};
    if (body.date !== undefined) {
      const date = parsePlanDate(body.date);
      if (!date) return jsonError("Please choose a valid service date.");
      update.date = date;
    }
    if (body.title !== undefined) {
      const title = String(body.title ?? "").trim();
      if (!title) return jsonError("Title cannot be empty.");
      update.title = title.slice(0, 120);
    }
    for (const key of ["theme", "scripture", "notes"] as const) {
      if (body[key] !== undefined) update[key] = String(body[key] ?? "").trim().slice(0, 2000);
    }
    if (body.status !== undefined) {
      if (!(PLAN_STATUSES as readonly string[]).includes(body.status))
        return jsonError("Invalid status.");
      update.status = body.status;
    }

    await connectDb();

    if (body.preacher !== undefined) {
      const preacherId = String(body.preacher ?? "").trim();
      if (!preacherId) {
        update.preacher = null;
        update.preacherName = "";
      } else {
        if (!isValidObjectId(preacherId)) return jsonError("Preacher not found.");
        const p = await Person.findOne({ _id: preacherId, churchId: user.churchId })
          .select("name")
          .lean();
        if (!p) return jsonError("Preacher not found.");
        update.preacher = p._id;
        update.preacherName = p.name;
      }
    }
    if (body.items !== undefined) {
      const { items, error } = await buildItems(user.churchId, body.items);
      if (error) return jsonError(error);
      update.items = items;
    }
    if (body.volunteers !== undefined) {
      const { volunteers, error } = await buildVolunteers(user.churchId, body.volunteers);
      if (error) return jsonError(error);
      update.volunteers = volunteers;
    }
    if (!Object.keys(update).length) return jsonError("Nothing to update.");

    const plan = await ServicePlan.findOneAndUpdate(
      { _id: id, churchId: user.churchId },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!plan) return jsonError("Service plan not found.", 404);

    await logActivity(user, "update", "servicePlan", planLabel(plan), id);
    return NextResponse.json({ plan: await serializePlan(user.churchId, plan) });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("services");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Service plan not found.", 404);

    await connectDb();
    const plan = await ServicePlan.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!plan) return jsonError("Service plan not found.", 404);

    await moveToRecycleBin({
      user,
      itemType: "servicePlan",
      label: planLabel(plan),
      doc: plan,
    });
    await ServicePlan.deleteOne({ _id: id, churchId: user.churchId });
    return NextResponse.json({ ok: true });
  });
}
