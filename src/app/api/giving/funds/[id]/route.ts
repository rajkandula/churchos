import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Fund } from "@/models/Fund";
import { Donation } from "@/models/Donation";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Fund not found.", 404);
    const body = await readBody(req);

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) return jsonError("Fund name cannot be empty.");
      if (name.length > 80) return jsonError("Fund name is too long.");
      update.name = name;
    }
    if (body.description !== undefined)
      update.description = String(body.description ?? "").trim();
    if (body.active !== undefined) update.active = Boolean(body.active);
    if (Object.keys(update).length === 0) return jsonError("Nothing to update.");

    await connectDb();
    if (update.name) {
      const clash = await Fund.findOne({
        _id: { $ne: id },
        churchId: user.churchId,
        name: new RegExp(
          `^${String(update.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
      }).lean();
      if (clash) return jsonError("A fund with that name already exists.");
    }

    const fund = await Fund.findOneAndUpdate(
      { _id: id, churchId: user.churchId },
      update,
      { new: true, runValidators: true }
    ).lean();
    if (!fund) return jsonError("Fund not found.", 404);

    // Keep the snapshot on receipts in step with a rename
    if (update.name) {
      await Donation.updateMany(
        { churchId: user.churchId, fund: fund._id },
        { $set: { fundName: fund.name } }
      );
    }
    await logActivity(user, "update", "fund", fund.name, id);

    return NextResponse.json({
      fund: {
        _id: String(fund._id),
        name: fund.name,
        description: fund.description ?? "",
        active: fund.active !== false,
      },
    });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Fund not found.", 404);

    await connectDb();
    const fund = await Fund.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!fund) return jsonError("Fund not found.", 404);

    const used = await Donation.countDocuments({ churchId: user.churchId, fund: fund._id });
    if (used > 0)
      return jsonError(
        `${fund.name} has ${used} donation${used === 1 ? "" : "s"} recorded against it. Deactivate it instead.`
      );

    await moveToRecycleBin({ user, itemType: "fund", label: fund.name, doc: fund });
    await Fund.deleteOne({ _id: id, churchId: user.churchId });

    return NextResponse.json({ ok: true });
  });
}
