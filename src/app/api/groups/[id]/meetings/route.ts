import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Group } from "@/models/Group";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity } from "@/lib/audit";
import { loadGroupDetail } from "@/lib/groups";

type Params = { params: Promise<{ id: string }> };

/** Date-only values are UTC midnight — label them in UTC so the day never shifts. */
function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function meetingsOf(churchId: string, id: string) {
  const group = await loadGroupDetail(churchId, id);
  return group?.meetings ?? [];
}

/** GET → { meetings } newest first */
export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("groups");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Group not found.", 404);

    await connectDb();
    const exists = await Group.exists({ _id: id, churchId: user.churchId });
    if (!exists) return jsonError("Group not found.", 404);
    return NextResponse.json({ meetings: await meetingsOf(user.churchId, id) });
  });
}

/** POST { date, presentIds, note } — log a meeting; a meeting already logged
 *  on the same date is replaced → { meetings } */
export async function POST(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("groups");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Group not found.", 404);
    const body = await readBody(req);

    const dateRaw = String(body.date ?? "").trim();
    if (!dateRaw) return jsonError("Please pick the meeting date.");
    // Date-only → UTC midnight, matching the rest of the app
    const date = new Date(dateRaw);
    if (Number.isNaN(date.getTime())) return jsonError("Invalid meeting date.");
    const dayStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

    const presentRaw: unknown[] = Array.isArray(body.presentIds) ? body.presentIds : [];
    const present = Array.from(
      new Set(presentRaw.map(String).filter((s) => isValidObjectId(s)))
    ).map((s) => new Types.ObjectId(s));
    const note = String(body.note ?? "").trim().slice(0, 2000);

    await connectDb();
    const group = await Group.findOne({ _id: id, churchId: user.churchId })
      .select("name meetings")
      .lean();
    if (!group) return jsonError("Group not found.", 404);

    const existing = (group.meetings ?? []).find((m) => {
      const t = new Date(m.date).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    });

    if (existing) {
      await Group.updateOne(
        { _id: id, churchId: user.churchId, "meetings._id": existing._id },
        {
          $set: {
            "meetings.$.date": dayStart,
            "meetings.$.present": present,
            "meetings.$.note": note,
          },
        }
      );
    } else {
      await Group.updateOne(
        { _id: id, churchId: user.churchId },
        { $push: { meetings: { date: dayStart, present, note } } }
      );
    }

    await logActivity(
      user,
      "update",
      "group",
      `${group.name} — meeting on ${formatDate(dayStart)} (${present.length} present)`,
      id
    );

    return NextResponse.json(
      { meetings: await meetingsOf(user.churchId, id) },
      { status: existing ? 200 : 201 }
    );
  });
}

/** DELETE { meetingId } → { meetings } */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("groups");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Group not found.", 404);
    const body = await readBody(req);
    const meetingId = String(body.meetingId ?? "").trim();
    if (!isValidObjectId(meetingId)) return jsonError("Meeting not found.", 404);

    await connectDb();
    const group = await Group.findOne({ _id: id, churchId: user.churchId })
      .select("name meetings")
      .lean();
    if (!group) return jsonError("Group not found.", 404);
    const meeting = (group.meetings ?? []).find((m) => String(m._id) === meetingId);
    if (!meeting) return jsonError("Meeting not found.", 404);

    await Group.updateOne(
      { _id: id, churchId: user.churchId },
      { $pull: { meetings: { _id: new Types.ObjectId(meetingId) } } }
    );

    await logActivity(
      user,
      "update",
      "group",
      `${group.name} — removed meeting on ${formatDate(meeting.date)}`,
      id
    );

    return NextResponse.json({ meetings: await meetingsOf(user.churchId, id) });
  });
}
