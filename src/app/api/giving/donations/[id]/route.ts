import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Donation } from "@/models/Donation";
import { Fund } from "@/models/Fund";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";
import { isPaymentMode, parseDate, shapeDonation, yearOf } from "@/lib/giving";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Donation not found.", 404);

    await connectDb();
    const donation = await Donation.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!donation) return jsonError("Donation not found.", 404);

    return NextResponse.json({ donation: shapeDonation(donation) });
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Donation not found.", 404);
    const body = await readBody(req);

    const update: Record<string, unknown> = {};
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 1)
        return jsonError("Please enter an amount of at least 1.");
      update.amount = Math.round(amount * 100) / 100;
    }
    if (body.mode !== undefined) {
      const mode = String(body.mode ?? "").trim();
      if (!isPaymentMode(mode)) return jsonError("Invalid payment mode.");
      update.mode = mode;
    }
    if (body.date !== undefined) {
      const date = parseDate(body.date);
      if (!date) return jsonError("Please enter a valid date.");
      update.date = date;
      update.year = yearOf(date);
    }
    if (body.reference !== undefined) update.reference = String(body.reference ?? "").trim();
    if (body.note !== undefined) update.note = String(body.note ?? "").trim();

    await connectDb();
    if (body.fund !== undefined) {
      const fundId = String(body.fund ?? "").trim();
      if (!fundId || !isValidObjectId(fundId)) return jsonError("Please choose a fund.");
      const fund = await Fund.findOne({ _id: fundId, churchId: user.churchId }).lean();
      if (!fund) return jsonError("Fund not found.");
      update.fund = fund._id;
      update.fundName = fund.name;
    }
    if (body.person !== undefined) {
      const personId = String(body.person ?? "").trim();
      if (personId) {
        if (!isValidObjectId(personId)) return jsonError("Person not found.");
        const person = await Person.findOne({ _id: personId, churchId: user.churchId })
          .select("name")
          .lean();
        if (!person) return jsonError("Person not found.");
        update.person = person._id;
        update.personName = person.name;
      } else {
        update.person = null;
        update.personName = "Anonymous";
      }
    }
    if (Object.keys(update).length === 0) return jsonError("Nothing to update.");

    const donation = await Donation.findOneAndUpdate(
      { _id: id, churchId: user.churchId },
      update,
      { new: true, runValidators: true }
    ).lean();
    if (!donation) return jsonError("Donation not found.", 404);

    await logActivity(
      user,
      "update",
      "donation",
      `${donation.receiptNo} — ${donation.personName}`,
      id
    );

    return NextResponse.json({ donation: shapeDonation(donation) });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Donation not found.", 404);

    await connectDb();
    const donation = await Donation.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!donation) return jsonError("Donation not found.", 404);

    await moveToRecycleBin({
      user,
      itemType: "donation",
      label: `${donation.receiptNo} — ${donation.personName}`,
      doc: donation,
    });
    await Donation.deleteOne({ _id: id, churchId: user.churchId });

    return NextResponse.json({ ok: true });
  });
}
