import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Staff } from "@/models/Staff";
import { requireChurch, withApi } from "@/lib/api-helpers";
import { buildStaffFilter } from "@/lib/staff-fields";
import {
  EMPLOYMENT_TYPE_LABELS,
  STAFF_STATUS_LABELS,
} from "@/app/dashboard/staff/types";

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
  "Staff No",
  "Name",
  "Title",
  "Ministry",
  "Employment Type",
  "Status",
  "Phone",
  "Email",
  "Address",
  "Joined",
  "Left",
  "Ordained",
  "Qualifications",
  "Emergency Contact",
  "Emergency Phone",
  "Emergency Relation",
  "Notes",
];

export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("staff");
    await connectDb();

    const filter = buildStaffFilter(req.nextUrl.searchParams);
    const staff = await Staff.find({ ...filter, churchId: user.churchId })
      .sort({ name: 1 })
      .lean();

    const rows = staff.map((s) =>
      [
        s.staffNo,
        s.name,
        s.title,
        s.ministry,
        EMPLOYMENT_TYPE_LABELS[s.employmentType] ?? s.employmentType,
        STAFF_STATUS_LABELS[s.status] ?? s.status,
        s.phone,
        s.email,
        s.address,
        csvDate(s.joinDate),
        csvDate(s.leaveDate),
        csvDate(s.ordinationDate),
        s.qualifications,
        s.emergencyContact?.name,
        s.emergencyContact?.phone,
        s.emergencyContact?.relation,
        s.notes,
      ]
        .map(csvCell)
        .join(",")
    );

    const csv = "﻿" + [HEADERS.join(","), ...rows].join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="staff.csv"',
      },
    });
  });
}
