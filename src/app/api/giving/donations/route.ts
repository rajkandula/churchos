import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Donation } from "@/models/Donation";
import { Fund } from "@/models/Fund";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { withSeqRetry } from "@/lib/seq";
import { logActivity } from "@/lib/audit";
import type { PAYMENT_MODES } from "@/lib/constants";
import {
  buildDonationFilter,
  isPaymentMode,
  nextReceiptNo,
  parseDate,
  shapeDonation,
  yearOf,
} from "@/lib/giving";

/** Filtered list, newest first, with the total of everything matched. */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    await connectDb();

    const params = req.nextUrl.searchParams;
    const filter = buildDonationFilter(params, user.churchId);
    const limit = Math.min(1000, Number(params.get("limit")) || 200);

    const [donations, totals] = await Promise.all([
      Donation.find(filter).sort({ date: -1, createdAt: -1 }).limit(limit).lean(),
      Donation.aggregate<{ total: number; count: number }>([
        { $match: filter },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
    ]);

    return NextResponse.json({
      donations: donations.map(shapeDonation),
      total: totals[0]?.total ?? 0,
      count: totals[0]?.count ?? 0,
    });
  });
}

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    const body = await readBody(req);

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 1)
      return jsonError("Please enter an amount of at least 1.");
    const fundId = String(body.fund ?? "").trim();
    if (!fundId || !isValidObjectId(fundId)) return jsonError("Please choose a fund.");
    const mode = String(body.mode ?? "Cash").trim() || "Cash";
    if (!isPaymentMode(mode)) return jsonError("Invalid payment mode.");
    const date = parseDate(body.date);
    if (!date) return jsonError("Please enter a valid date.");
    const reference = String(body.reference ?? "").trim();
    const note = String(body.note ?? "").trim();
    const personId = String(body.person ?? "").trim();
    if (personId && !isValidObjectId(personId)) return jsonError("Person not found.");

    await connectDb();
    const fund = await Fund.findOne({ _id: fundId, churchId: user.churchId }).lean();
    if (!fund) return jsonError("Fund not found.");

    let personName = "Anonymous";
    if (personId) {
      const person = await Person.findOne({ _id: personId, churchId: user.churchId })
        .select("name")
        .lean();
      if (!person) return jsonError("Person not found.");
      personName = person.name;
    }

    const donation = await withSeqRetry(async (attempt) =>
      Donation.create({
        churchId: user.churchId,
        receiptNo: await nextReceiptNo(user.churchId, attempt),
        person: personId || null,
        personName,
        fund: fund._id,
        fundName: fund.name,
        amount: Math.round(amount * 100) / 100,
        mode: mode as (typeof PAYMENT_MODES)[number],
        date,
        reference,
        note,
        year: yearOf(date),
        createdBy: new Types.ObjectId(user.id),
      })
    );
    if (!donation)
      return jsonError("Could not allocate a receipt number. Try again.", 500);

    await logActivity(
      user,
      "create",
      "donation",
      `${donation.receiptNo} — ${personName}`,
      donation._id
    );

    return NextResponse.json({ donation: shapeDonation(donation.toObject()) }, { status: 201 });
  });
}
