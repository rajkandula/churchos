import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Household } from "@/models/Household";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";
import { pickHouseholdFields } from "../route";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("people");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Household not found.", 404);
    await connectDb();
    const household = await Household.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!household) return jsonError("Household not found.", 404);
    const members = await Person.find({ churchId: user.churchId, household: id })
      .select("name memberNo householdRole phone photoUrl status dob")
      .sort({ name: 1 })
      .lean();
    return NextResponse.json({
      household: {
        ...household,
        _id: String(household._id),
        head: household.head ? String(household.head) : null,
      },
      members: members.map((m) => ({ ...m, _id: String(m._id) })),
    });
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("people");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Household not found.", 404);
    const body = await readBody(req);
    const update = pickHouseholdFields(body);
    if (update.name === "") return jsonError("Household name cannot be empty.");

    await connectDb();
    const household = await Household.findOneAndUpdate(
      { _id: id, churchId: user.churchId },
      update,
      { new: true, runValidators: true }
    ).lean();
    if (!household) return jsonError("Household not found.", 404);

    // Membership changes: { addMemberIds, removeMemberIds, roles: {personId: role} }
    if (Array.isArray(body.addMemberIds) && body.addMemberIds.length) {
      const ids = body.addMemberIds.filter((x: unknown) => isValidObjectId(String(x)));
      await Person.updateMany(
        { _id: { $in: ids }, churchId: user.churchId },
        { $set: { household: household._id } }
      );
    }
    if (Array.isArray(body.removeMemberIds) && body.removeMemberIds.length) {
      const ids = body.removeMemberIds.filter((x: unknown) => isValidObjectId(String(x)));
      await Person.updateMany(
        { _id: { $in: ids }, churchId: user.churchId, household: household._id },
        { $set: { household: null, householdRole: "" } }
      );
    }
    if (body.roles && typeof body.roles === "object") {
      for (const [pid, role] of Object.entries(body.roles as Record<string, string>)) {
        if (!isValidObjectId(pid)) continue;
        await Person.updateOne(
          { _id: pid, churchId: user.churchId, household: household._id },
          { $set: { householdRole: String(role ?? "") } }
        );
      }
    }

    await logActivity(user, "update", "household", household.name, id);
    return NextResponse.json({ household });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("people");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Household not found.", 404);
    await connectDb();
    const household = await Household.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!household) return jsonError("Household not found.", 404);
    await moveToRecycleBin({
      user,
      itemType: "household",
      label: household.name,
      doc: household,
    });
    await Household.deleteOne({ _id: id, churchId: user.churchId });
    await Person.updateMany(
      { churchId: user.churchId, household: id },
      { $set: { household: null, householdRole: "" } }
    );
    return NextResponse.json({ ok: true });
  });
}
