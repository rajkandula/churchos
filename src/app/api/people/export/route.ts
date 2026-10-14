import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Person } from "@/models/Person";
import { Household } from "@/models/Household";
import { requireChurch, withApi } from "@/lib/api-helpers";
import { buildPersonFilter } from "@/lib/person-fields";

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

const HEADERS = [
  "Member No",
  "Name",
  "Status",
  "Gender",
  "Date of Birth",
  "Marital Status",
  "Phone",
  "Alternate Phone",
  "Email",
  "Address",
  "City",
  "State",
  "PIN Code",
  "Household",
  "Household Role",
  "Member Since",
  "First Visit",
  "Baptism Date",
  "Tags",
  "Occupation",
];

export async function GET(req: NextRequest) {
  return withApi(async () => {
    // The whole directory as a file is a People action — the unkeyed People
    // reads exist so pickers in other apps can look up a name, nothing more.
    const user = await requireChurch("people");
    await connectDb();

    const filter = buildPersonFilter(req.nextUrl.searchParams);
    const people = await Person.find({ ...filter, churchId: user.churchId })
      .sort({ name: 1 })
      .lean();
    const hh = await Household.find({ churchId: user.churchId }).select("name").lean();
    const householdName = new Map(hh.map((h) => [String(h._id), h.name]));

    const rows = people.map((p) =>
      [
        p.memberNo,
        p.name,
        p.status,
        p.gender,
        csvDate(p.dob),
        p.maritalStatus,
        p.phone,
        p.altPhone,
        p.email,
        p.address,
        p.city,
        p.state,
        p.pincode,
        p.household ? (householdName.get(String(p.household)) ?? "") : "",
        p.householdRole,
        csvDate(p.memberSince),
        csvDate(p.firstVisit),
        csvDate(p.baptismDate),
        (p.tags ?? []).join("; "),
        p.occupation,
      ]
        .map(csvCell)
        .join(",")
    );

    const csv = "﻿" + [HEADERS.join(","), ...rows].join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="people.csv"',
      },
    });
  });
}
