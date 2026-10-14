import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Group } from "@/models/Group";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";
import {
  isDuplicateKey,
  loadGroupDetail,
  pickGroupFields,
  resolveLeaders,
} from "@/lib/groups";

type Params = { params: Promise<{ id: string }> };

/** GET → { group } with members enriched from the live People register */
export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("groups");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Group not found.", 404);

    await connectDb();
    const group = await loadGroupDetail(user.churchId, id);
    if (!group) return jsonError("Group not found.", 404);
    return NextResponse.json({ group });
  });
}

/** PATCH — any scalar field, leader, coLeaders → { group } */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("groups");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Group not found.", 404);
    const body = await readBody(req);

    const { update, error } = pickGroupFields(body);
    if (error) return jsonError(error);

    await connectDb();
    const leaders = await resolveLeaders(user.churchId, body);
    if (leaders.error) return jsonError(leaders.error);
    Object.assign(update, leaders.update);

    if (Object.keys(update).length === 0)
      return jsonError("Nothing to update.");

    let updated;
    try {
      updated = await Group.findOneAndUpdate(
        { _id: id, churchId: user.churchId },
        { $set: update },
        { new: true, runValidators: true }
      ).lean();
    } catch (err) {
      if (isDuplicateKey(err))
        return jsonError("A group with that name already exists.");
      throw err;
    }
    if (!updated) return jsonError("Group not found.", 404);

    await logActivity(user, "update", "group", updated.name, id);

    const group = await loadGroupDetail(user.churchId, id);
    return NextResponse.json({ group });
  });
}

/** DELETE → Recycle Bin, then remove → { ok: true } */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("groups");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Group not found.", 404);

    await connectDb();
    const group = await Group.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!group) return jsonError("Group not found.", 404);

    await moveToRecycleBin({
      user,
      itemType: "group",
      label: group.name,
      doc: group,
    });
    await Group.deleteOne({ _id: id, churchId: user.churchId });

    return NextResponse.json({ ok: true });
  });
}
