import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { ConnectCard } from "@/models/ConnectCard";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { pickCardFields, shapeCard } from "@/lib/connect-fields";
import { logActivity } from "@/lib/audit";
import { User } from "@/models/User";
import {
  CONNECT_STATUSES,
  type ConnectStatus,
} from "@/app/dashboard/connect/types";

/** List cards for the board. `status`, `q`, `assigned` ("unassigned" | userId). */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("connect");
    await connectDb();

    const params = req.nextUrl.searchParams;
    const filter: Record<string, unknown> = { churchId: user.churchId };

    const q = (params.get("q") ?? "").trim();
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: re }, { phone: re }, { email: re }, { city: re }];
    }
    const assigned = (params.get("assigned") ?? "").trim();
    if (assigned === "unassigned") filter.assignedTo = null;
    else if (assigned && isValidObjectId(assigned)) filter.assignedTo = assigned;

    // Counts respect search/assignee but not the status filter, so the
    // board's column headers always add up to what is on screen.
    const countRows = await ConnectCard.aggregate<{ _id: string; n: number }>([
      { $match: { ...filter, churchId: new Types.ObjectId(user.churchId) } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]);
    const counts: Record<string, number> = {};
    for (const s of CONNECT_STATUSES) counts[s] = 0;
    for (const row of countRows) counts[row._id] = row.n;

    const status = (params.get("status") ?? "").trim();
    if (status && (CONNECT_STATUSES as readonly string[]).includes(status))
      filter.status = status;

    const cards = await ConnectCard.find(filter)
      .sort({ visitDate: -1, createdAt: -1 })
      .limit(1000)
      .lean();

    return NextResponse.json({ cards: cards.map(shapeCard), counts });
  });
}

/** Staff adds a card by hand (e.g. from a paper card). */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("connect");
    const body = await readBody(req);

    if (body.name === undefined) body.name = "";
    const picked = pickCardFields(body);
    if (picked.error) return jsonError(picked.error);
    const fields = picked.fields;

    let status: ConnectStatus = "new";
    if (body.status !== undefined) {
      if (!(CONNECT_STATUSES as readonly string[]).includes(body.status))
        return jsonError("Invalid status.");
      status = body.status;
    }

    await connectDb();

    let assignedTo: string | null = null;
    let assignedToName = "";
    if (body.assignedTo) {
      const id = String(body.assignedTo);
      if (!isValidObjectId(id)) return jsonError("Assignee not found.");
      const assignee = await User.findOne({ _id: id, churchId: user.churchId })
        .select("name")
        .lean();
      if (!assignee) return jsonError("Assignee not found.");
      assignedTo = id;
      assignedToName = assignee.name;
    }

    const card = await ConnectCard.create({
      churchId: user.churchId,
      ...fields,
      status,
      assignedTo,
      assignedToName,
      source: "admin",
      createdBy: new Types.ObjectId(user.id),
    });

    await logActivity(user, "create", "connectCard", card.name, card._id);

    return NextResponse.json(
      { card: shapeCard(card.toObject()) },
      { status: 201 }
    );
  });
}
