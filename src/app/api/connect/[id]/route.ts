import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ConnectCard } from "@/models/ConnectCard";
import { User } from "@/models/User";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { pickCardFields, shapeCard } from "@/lib/connect-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";
import { CONNECT_STATUSES } from "@/app/dashboard/connect/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("connect");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Card not found.", 404);

    await connectDb();
    const card = await ConnectCard.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!card) return jsonError("Card not found.", 404);
    return NextResponse.json({ card: shapeCard(card) });
  });
}

/** Edit fields, move status, or (re)assign — any subset in one call. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("connect");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Card not found.", 404);
    const body = await readBody(req);

    const picked = pickCardFields(body);
    if (picked.error) return jsonError(picked.error);
    const update: Record<string, unknown> = { ...picked.fields };

    if (body.status !== undefined) {
      if (!(CONNECT_STATUSES as readonly string[]).includes(body.status))
        return jsonError("Invalid status.");
      update.status = body.status;
    }

    await connectDb();

    if (body.assignedTo !== undefined) {
      const assignee = String(body.assignedTo ?? "").trim();
      if (!assignee) {
        update.assignedTo = null;
        update.assignedToName = "";
      } else {
        if (!isValidObjectId(assignee)) return jsonError("Assignee not found.");
        const u = await User.findOne({ _id: assignee, churchId: user.churchId })
          .select("name")
          .lean();
        if (!u) return jsonError("Assignee not found.");
        update.assignedTo = assignee;
        update.assignedToName = u.name;
      }
    }

    if (Object.keys(update).length === 0)
      return jsonError("Nothing to update.");

    const card = await ConnectCard.findOneAndUpdate(
      { _id: id, churchId: user.churchId },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!card) return jsonError("Card not found.", 404);

    await logActivity(user, "update", "connectCard", card.name, id);

    return NextResponse.json({ card: shapeCard(card) });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("connect");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Card not found.", 404);

    await connectDb();
    const card = await ConnectCard.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!card) return jsonError("Card not found.", 404);

    await moveToRecycleBin({
      user,
      itemType: "connectCard",
      label: card.name,
      doc: card,
    });
    await ConnectCard.deleteOne({ _id: id, churchId: user.churchId });

    return NextResponse.json({ ok: true });
  });
}
