import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Fund } from "@/models/Fund";
import { Donation } from "@/models/Donation";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { logActivity } from "@/lib/audit";
import { currentYear } from "@/lib/seq";
import { ensureDefaultFunds } from "@/lib/giving";

/** All funds, each with this calendar year's total received. */
export async function GET() {
  return withApi(async () => {
    const user = await requireChurch("giving");
    await connectDb();
    await ensureDefaultFunds(user.churchId, user.id);

    const year = currentYear();
    const [funds, totals] = await Promise.all([
      Fund.find({ churchId: user.churchId }).sort({ active: -1, name: 1 }).lean(),
      Donation.aggregate<{ _id: Types.ObjectId; total: number; count: number }>([
        { $match: { churchId: new Types.ObjectId(user.churchId), year } },
        { $group: { _id: "$fund", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
    ]);
    const byFund = new Map(totals.map((t) => [String(t._id), t]));

    return NextResponse.json({
      year,
      funds: funds.map((f) => ({
        _id: String(f._id),
        name: f.name,
        description: f.description ?? "",
        active: f.active !== false,
        total: byFund.get(String(f._id))?.total ?? 0,
        count: byFund.get(String(f._id))?.count ?? 0,
        createdAt: f.createdAt,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    const body = await readBody(req);

    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("Please enter the fund's name.");
    if (name.length > 80) return jsonError("Fund name is too long.");
    const description = String(body.description ?? "").trim();
    const active = body.active === undefined ? true : Boolean(body.active);

    await connectDb();
    const clash = await Fund.findOne({
      churchId: user.churchId,
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    }).lean();
    if (clash) return jsonError("A fund with that name already exists.");

    const fund = await Fund.create({
      churchId: user.churchId,
      name,
      description,
      active,
      createdBy: new Types.ObjectId(user.id),
    });
    await logActivity(user, "create", "fund", fund.name, fund._id);

    return NextResponse.json(
      {
        fund: {
          _id: String(fund._id),
          name: fund.name,
          description: fund.description ?? "",
          active: fund.active !== false,
          total: 0,
          count: 0,
          createdAt: fund.createdAt,
        },
      },
      { status: 201 }
    );
  });
}
