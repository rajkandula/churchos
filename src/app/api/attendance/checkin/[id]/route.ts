import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { CheckIn } from "@/models/CheckIn";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";
import { shapeCheckIn } from "../shape";

type Params = { params: Promise<{ id: string }> };

/** One check-in — the printable label reads from here. */
export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("attendance");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Check-in not found.", 404);

    await connectDb();
    const checkIn = await CheckIn.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!checkIn) return jsonError("Check-in not found.", 404);
    return NextResponse.json({ checkIn: shapeCheckIn(checkIn) });
  });
}

/** PATCH { action: "checkout" } → stamps checkedOutAt. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("attendance");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Check-in not found.", 404);
    const body = await readBody(req);
    const action = String(body.action ?? "");
    if (action !== "checkout" && action !== "undo-checkout")
      return jsonError("Unknown action.");

    await connectDb();
    const checkIn = await CheckIn.findOneAndUpdate(
      { _id: id, churchId: user.churchId },
      { $set: { checkedOutAt: action === "checkout" ? new Date() : null } },
      { new: true }
    ).lean();
    if (!checkIn) return jsonError("Check-in not found.", 404);

    await logActivity(
      user,
      "update",
      "checkIn",
      `${checkIn.personName} ${action === "checkout" ? "checked out" : "check-out undone"} (${checkIn.securityCode})`,
      id
    );
    return NextResponse.json({ checkIn: shapeCheckIn(checkIn) });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("attendance");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Check-in not found.", 404);

    await connectDb();
    const checkIn = await CheckIn.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!checkIn) return jsonError("Check-in not found.", 404);
    await moveToRecycleBin({
      user,
      itemType: "checkIn",
      label: `${checkIn.personName} (${checkIn.securityCode})`,
      doc: checkIn,
    });
    await CheckIn.deleteOne({ _id: id, churchId: user.churchId });
    return NextResponse.json({ ok: true });
  });
}
