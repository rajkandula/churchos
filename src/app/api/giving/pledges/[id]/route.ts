import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Pledge, PLEDGE_FREQUENCIES, PLEDGE_STATUSES } from "@/models/Pledge";
import { Fund } from "@/models/Fund";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";
import { parseDate } from "@/lib/giving";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Pledge not found.", 404);
    const body = await readBody(req);

    const update: Record<string, unknown> = {};
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 1)
        return jsonError("Please enter a pledged amount of at least 1.");
      update.amount = Math.round(amount * 100) / 100;
    }
    if (body.frequency !== undefined) {
      const frequency = String(body.frequency ?? "").trim();
      if (!(PLEDGE_FREQUENCIES as readonly string[]).includes(frequency))
        return jsonError("Invalid frequency.");
      update.frequency = frequency;
    }
    if (body.status !== undefined) {
      const status = String(body.status ?? "").trim();
      if (!(PLEDGE_STATUSES as readonly string[]).includes(status))
        return jsonError("Invalid status.");
      update.status = status;
    }
    if (body.startDate !== undefined) {
      const d = body.startDate ? parseDate(body.startDate) : null;
      if (body.startDate && !d) return jsonError("Please enter a valid start date.");
      update.startDate = d;
    }
    if (body.endDate !== undefined) {
      const d = body.endDate ? parseDate(body.endDate) : null;
      if (body.endDate && !d) return jsonError("Please enter a valid end date.");
      update.endDate = d;
    }
    if (body.note !== undefined) update.note = String(body.note ?? "").trim();

    await connectDb();
    if (body.person !== undefined) {
      const personId = String(body.person ?? "").trim();
      if (!personId || !isValidObjectId(personId)) return jsonError("Please choose a person.");
      const person = await Person.findOne({ _id: personId, churchId: user.churchId })
        .select("name")
        .lean();
      if (!person) return jsonError("Person not found.");
      update.person = person._id;
      update.personName = person.name;
    }
    if (body.fund !== undefined) {
      const fundId = String(body.fund ?? "").trim();
      if (fundId) {
        if (!isValidObjectId(fundId)) return jsonError("Fund not found.");
        const fund = await Fund.findOne({ _id: fundId, churchId: user.churchId })
          .select("name")
          .lean();
        if (!fund) return jsonError("Fund not found.");
        update.fund = fund._id;
        update.fundName = fund.name;
      } else {
        update.fund = null;
        update.fundName = "";
      }
    }
    if (Object.keys(update).length === 0) return jsonError("Nothing to update.");

    const current = await Pledge.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!current) return jsonError("Pledge not found.", 404);
    const start = (update.startDate !== undefined ? update.startDate : current.startDate) as
      | Date
      | null
      | undefined;
    const end = (update.endDate !== undefined ? update.endDate : current.endDate) as
      | Date
      | null
      | undefined;
    if (start && end && new Date(end) < new Date(start))
      return jsonError("End date must be after the start date.");

    const pledge = await Pledge.findOneAndUpdate(
      { _id: id, churchId: user.churchId },
      update,
      { new: true, runValidators: true }
    ).lean();
    if (!pledge) return jsonError("Pledge not found.", 404);

    await logActivity(
      user,
      "update",
      "pledge",
      `${pledge.personName} — ${pledge.fundName || "Any fund"}`,
      id
    );

    return NextResponse.json({
      pledge: {
        _id: String(pledge._id),
        person: String(pledge.person),
        personName: pledge.personName ?? "",
        fund: pledge.fund ? String(pledge.fund) : null,
        fundName: pledge.fundName ?? "",
        amount: pledge.amount,
        frequency: pledge.frequency ?? "one-time",
        startDate: pledge.startDate ?? null,
        endDate: pledge.endDate ?? null,
        note: pledge.note ?? "",
        status: pledge.status ?? "active",
      },
    });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Pledge not found.", 404);

    await connectDb();
    const pledge = await Pledge.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!pledge) return jsonError("Pledge not found.", 404);

    await moveToRecycleBin({
      user,
      itemType: "pledge",
      label: `${pledge.personName} — ${pledge.fundName || "Any fund"}`,
      doc: pledge,
    });
    await Pledge.deleteOne({ _id: id, churchId: user.churchId });

    return NextResponse.json({ ok: true });
  });
}
