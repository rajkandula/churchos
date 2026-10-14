import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Donation } from "@/models/Donation";
import { requireChurch, withApi } from "@/lib/api-helpers";
import { buildDonationFilter } from "@/lib/giving";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvDate(value: unknown): string {
  if (!value) return "";
  return new Date(value as string).toLocaleDateString("en-IN", {
    timeZone: "UTC",
  });
}

const HEADERS = ["Receipt No", "Date", "Name", "Fund", "Amount", "Mode", "Reference", "Note"];

/** CSV of the donations matching the same filters as the list. */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("giving");
    await connectDb();

    const filter = buildDonationFilter(req.nextUrl.searchParams, user.churchId);
    const donations = await Donation.find(filter).sort({ date: -1, createdAt: -1 }).lean();

    const rows = donations.map((d) =>
      [
        d.receiptNo,
        csvDate(d.date),
        d.personName || "Anonymous",
        d.fundName,
        d.amount,
        d.mode,
        d.reference,
        d.note,
      ]
        .map(csvCell)
        .join(",")
    );

    const csv = "﻿" + [HEADERS.join(","), ...rows].join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="donations.csv"',
      },
    });
  });
}
