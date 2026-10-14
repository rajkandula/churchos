import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Donation } from "@/models/Donation";
import { Person } from "@/models/Person";
import { Church } from "@/models/Church";
import { jsonError, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { currentYear } from "@/lib/seq";
import { shapeDonation } from "@/lib/giving";

type Params = { params: Promise<{ personId: string }> };

/** Everything the printable annual statement needs for one person. */
export async function GET(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    const { personId } = await params;
    if (!isValidObjectId(personId)) return jsonError("Person not found.", 404);
    const yearParam = (req.nextUrl.searchParams.get("year") ?? "").trim();
    const year = /^\d{4}$/.test(yearParam) ? yearParam : currentYear();

    await connectDb();
    const [church, person, donations] = await Promise.all([
      Church.findById(user.churchId).lean(),
      Person.findOne({ _id: personId, churchId: user.churchId }).lean(),
      Donation.find({ churchId: user.churchId, person: personId, year })
        .sort({ date: 1, createdAt: 1 })
        .lean(),
    ]);
    if (!church) return jsonError("Church not found.", 404);
    if (!person) return jsonError("Person not found.", 404);

    const byFundMap = new Map<string, { fundId: string; fundName: string; total: number; count: number }>();
    let total = 0;
    for (const d of donations) {
      total += d.amount;
      const key = String(d.fund);
      const row = byFundMap.get(key) ?? {
        fundId: key,
        fundName: d.fundName ?? "",
        total: 0,
        count: 0,
      };
      row.total += d.amount;
      row.count += 1;
      byFundMap.set(key, row);
    }
    const byFund = Array.from(byFundMap.values()).sort((a, b) => b.total - a.total);

    return NextResponse.json({
      church: {
        name: church.name,
        address: church.address ?? "",
        phone: church.phone ?? "",
        email: church.email ?? "",
        logoUrl: church.logoUrl ?? "",
        currency: church.currency ?? "INR",
      },
      person: {
        _id: String(person._id),
        name: person.name,
        memberNo: person.memberNo,
        address: person.address ?? "",
        city: person.city ?? "",
        state: person.state ?? "",
        pincode: person.pincode ?? "",
        phone: person.phone ?? "",
        email: person.email ?? "",
      },
      year,
      donations: donations.map(shapeDonation),
      total,
      count: donations.length,
      byFund,
    });
  });
}
