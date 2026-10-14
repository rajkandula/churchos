import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ConnectCard } from "@/models/ConnectCard";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { shapeCard } from "@/lib/connect-fields";
import { logActivity } from "@/lib/audit";
import {
  FOLLOW_UP_METHODS,
  FOLLOW_UP_METHOD_LABELS,
  type FollowUpMethod,
} from "@/app/dashboard/connect/types";

type Params = { params: Promise<{ id: string }> };

/** Log a touch-point. A card still marked "new" moves to "contacted". */
export async function POST(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("connect");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Card not found.", 404);
    const body = await readBody(req);

    const method = String(body.method ?? "").trim();
    if (!(FOLLOW_UP_METHODS as readonly string[]).includes(method))
      return jsonError("Pick how you followed up (call, text, email…).");
    const note = String(body.note ?? "").trim().slice(0, 2000);

    await connectDb();
    const existing = await ConnectCard.findOne({ _id: id, churchId: user.churchId })
      .select("status")
      .lean();
    if (!existing) return jsonError("Card not found.", 404);

    const $set: Record<string, unknown> = {};
    if (existing.status === "new") $set.status = "contacted";

    const card = await ConnectCard.findOneAndUpdate(
      { _id: id, churchId: user.churchId },
      {
        $push: {
          followUps: {
            at: new Date(),
            by: user.name,
            method: method as FollowUpMethod,
            note,
          },
        },
        ...(Object.keys($set).length ? { $set } : {}),
      },
      { new: true, runValidators: true }
    ).lean();
    if (!card) return jsonError("Card not found.", 404);

    await logActivity(
      user,
      "update",
      "connectCard",
      `${card.name} — ${FOLLOW_UP_METHOD_LABELS[method as FollowUpMethod]}`,
      id
    );

    return NextResponse.json({ card: shapeCard(card) }, { status: 201 });
  });
}

/** Remove one follow-up entry by its `followUpId`. */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("connect");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Card not found.", 404);
    const body = await readBody(req);
    const followUpId = String(body.followUpId ?? "").trim();
    if (!isValidObjectId(followUpId)) return jsonError("Follow-up not found.", 404);

    await connectDb();
    const card = await ConnectCard.findOneAndUpdate(
      { _id: id, churchId: user.churchId },
      { $pull: { followUps: { _id: followUpId } } },
      { new: true }
    ).lean();
    if (!card) return jsonError("Card not found.", 404);

    await logActivity(user, "update", "connectCard", card.name, id);

    return NextResponse.json({ card: shapeCard(card) });
  });
}
