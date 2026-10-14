import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Event } from "@/models/Event";
import { Registration } from "@/models/Registration";
import { jsonError, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";

type Params = { params: Promise<{ id: string }> };

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvDateTime(value: unknown): string {
  if (!value) return "";
  return new Date(value as string).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const HEADERS = [
  "Name",
  "Phone",
  "Email",
  "Guests",
  "Status",
  "Source",
  "In People",
  "Registered At",
  "Notes",
];

export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("events");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Event not found.", 404);

    await connectDb();
    const event = await Event.findOne({ _id: id, churchId: user.churchId })
      .select("title")
      .lean();
    if (!event) return jsonError("Event not found.", 404);

    const registrations = await Registration.find({
      churchId: user.churchId,
      event: id,
    })
      .sort({ registeredAt: 1 })
      .lean();

    const rows = registrations.map((r) =>
      [
        r.name,
        r.phone,
        r.email,
        r.guests ?? 0,
        r.status,
        r.source,
        r.person ? "Yes" : "No",
        csvDateTime(r.registeredAt),
        r.notes,
      ]
        .map(csvCell)
        .join(",")
    );

    const csv = "﻿" + [HEADERS.join(","), ...rows].join("\r\n");
    const fileName = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "event";
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}-registrations.csv"`,
      },
    });
  });
}
