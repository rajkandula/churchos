import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Donation } from "@/models/Donation";
import { jsonError, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { currentYear } from "@/lib/seq";
import { churchCurrency } from "@/lib/giving";

type Params = { params: Promise<{ id: string }> };

/** The People profile's giving tile — this calendar year for one person.
 *  Shape is a contract with /dashboard/people/[id]; keep it stable. */
export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Person not found.", 404);

    await connectDb();
    const year = currentYear();
    const [rows, currency] = await Promise.all([
      Donation.aggregate<{ total: number; count: number; lastDate: Date }>([
        {
          $match: {
            churchId: new Types.ObjectId(user.churchId),
            person: new Types.ObjectId(id),
            year,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            count: { $sum: 1 },
            lastDate: { $max: "$date" },
          },
        },
      ]),
      churchCurrency(user.churchId),
    ]);

    return NextResponse.json({
      year,
      total: rows[0]?.total ?? 0,
      count: rows[0]?.count ?? 0,
      lastDate: rows[0]?.lastDate ?? null,
      currency,
    });
  });
}
