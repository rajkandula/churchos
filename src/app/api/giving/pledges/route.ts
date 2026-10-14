import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Pledge, PLEDGE_FREQUENCIES } from "@/models/Pledge";
import { Donation } from "@/models/Donation";
import { Fund } from "@/models/Fund";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity } from "@/lib/audit";
import { parseDate } from "@/lib/giving";

type PledgeLean = {
  _id: unknown;
  person: unknown;
  personName?: string;
  fund?: unknown;
  fundName?: string;
  amount: number;
  frequency?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  note?: string;
  status?: string;
  createdAt?: Date;
};

/** Pledges plus what has actually been given against each one. */
export async function GET() {
  return withApi(async () => {
    const user = await requireChurch("giving");
    await connectDb();

    const pledges = await Pledge.find({ churchId: user.churchId })
      .sort({ status: 1, createdAt: -1 })
      .lean();

    // One query for all the gifts these pledgers made, then match in memory
    const personIds = Array.from(new Set(pledges.map((p) => String(p.person))));
    const gifts = personIds.length
      ? await Donation.find({
          churchId: user.churchId,
          person: { $in: personIds.map((id) => new Types.ObjectId(id)) },
        })
          .select("person fund amount date")
          .lean()
      : [];

    const withProgress = pledges.map((p) => {
      const pledge = p as PledgeLean;
      const given = gifts
        .filter((g) => {
          if (String(g.person) !== String(pledge.person)) return false;
          if (pledge.fund && String(g.fund) !== String(pledge.fund)) return false;
          const t = new Date(g.date).getTime();
          if (pledge.startDate && t < new Date(pledge.startDate).getTime()) return false;
          if (pledge.endDate) {
            const end = new Date(pledge.endDate);
            end.setUTCHours(23, 59, 59, 999);
            if (t > end.getTime()) return false;
          }
          return true;
        })
        .reduce((sum, g) => sum + g.amount, 0);
      const progress =
        pledge.amount > 0 ? Math.min(100, Math.round((given / pledge.amount) * 100)) : 0;
      return shapePledge(pledge, given, progress);
    });

    return NextResponse.json({ pledges: withProgress });
  });
}

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    const body = await readBody(req);

    const personId = String(body.person ?? "").trim();
    if (!personId || !isValidObjectId(personId)) return jsonError("Please choose a person.");
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 1)
      return jsonError("Please enter a pledged amount of at least 1.");
    const frequency = String(body.frequency ?? "one-time").trim() || "one-time";
    if (!(PLEDGE_FREQUENCIES as readonly string[]).includes(frequency))
      return jsonError("Invalid frequency.");
    const startDate = body.startDate ? parseDate(body.startDate) : null;
    if (body.startDate && !startDate) return jsonError("Please enter a valid start date.");
    const endDate = body.endDate ? parseDate(body.endDate) : null;
    if (body.endDate && !endDate) return jsonError("Please enter a valid end date.");
    if (startDate && endDate && endDate < startDate)
      return jsonError("End date must be after the start date.");
    const note = String(body.note ?? "").trim();
    const fundId = String(body.fund ?? "").trim();
    if (fundId && !isValidObjectId(fundId)) return jsonError("Fund not found.");

    await connectDb();
    const person = await Person.findOne({ _id: personId, churchId: user.churchId })
      .select("name")
      .lean();
    if (!person) return jsonError("Person not found.");
    let fund: { _id: Types.ObjectId; name: string } | null = null;
    if (fundId) {
      fund = await Fund.findOne({ _id: fundId, churchId: user.churchId }).select("name").lean();
      if (!fund) return jsonError("Fund not found.");
    }

    const pledge = await Pledge.create({
      churchId: user.churchId,
      person: person._id,
      personName: person.name,
      fund: fund ? fund._id : null,
      fundName: fund?.name ?? "",
      amount: Math.round(amount * 100) / 100,
      frequency: frequency as (typeof PLEDGE_FREQUENCIES)[number],
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
      note,
      status: "active",
      createdBy: new Types.ObjectId(user.id),
    });
    await logActivity(
      user,
      "create",
      "pledge",
      `${person.name} — ${fund?.name ?? "Any fund"}`,
      pledge._id
    );

    return NextResponse.json(
      { pledge: shapePledge(pledge.toObject() as PledgeLean, 0, 0) },
      { status: 201 }
    );
  });
}

function shapePledge(p: PledgeLean, given: number, progress: number) {
  return {
    _id: String(p._id),
    person: String(p.person),
    personName: p.personName ?? "",
    fund: p.fund ? String(p.fund) : null,
    fundName: p.fundName ?? "",
    amount: p.amount,
    frequency: p.frequency ?? "one-time",
    startDate: p.startDate ?? null,
    endDate: p.endDate ?? null,
    note: p.note ?? "",
    status: p.status ?? "active",
    given,
    progress,
    createdAt: p.createdAt,
  };
}
