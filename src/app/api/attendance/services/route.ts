import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Service } from "@/models/Service";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isDuplicateKeyError, pickServiceFields } from "@/lib/attendance-fields";
import { logActivity } from "@/lib/audit";
import { DEFAULT_SERVICES } from "@/lib/constants";

function shape(s: {
  _id: unknown;
  name: string;
  dayOfWeek?: string | null;
  time?: string | null;
  location?: string | null;
  active?: boolean | null;
  sortOrder?: number | null;
}) {
  return {
    _id: String(s._id),
    name: s.name,
    dayOfWeek: s.dayOfWeek ?? "",
    time: s.time ?? "",
    location: s.location ?? "",
    active: s.active !== false,
    sortOrder: s.sortOrder ?? 0,
  };
}

/** Seed the common gathering names the first time a church opens Attendance.
 *  Safe to run repeatedly — the unique index makes duplicates a no-op. */
async function seedDefaults(churchId: string, userId: string) {
  const docs = DEFAULT_SERVICES.map((name, i) => ({
    churchId,
    name,
    dayOfWeek: name.startsWith("Sunday") ? "Sunday" : "",
    time: "",
    location: "",
    active: true,
    sortOrder: i,
    createdBy: new Types.ObjectId(userId),
  }));
  try {
    await Service.insertMany(docs, { ordered: false });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
  }
}

export async function GET() {
  return withApi(async () => {
    const user = await requireChurch("attendance");
    await connectDb();

    let services = await Service.find({ churchId: user.churchId })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    if (services.length === 0) {
      await seedDefaults(user.churchId, user.id);
      services = await Service.find({ churchId: user.churchId })
        .sort({ sortOrder: 1, name: 1 })
        .lean();
    }
    return NextResponse.json({ services: services.map(shape) });
  });
}

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("attendance");
    const body = await readBody(req);

    const picked = pickServiceFields({ ...body, name: body.name ?? "" });
    if (!picked.ok) return jsonError(picked.error);

    await connectDb();
    const count = await Service.countDocuments({ churchId: user.churchId });
    try {
      const service = await Service.create({
        churchId: user.churchId,
        sortOrder: count,
        ...picked.data,
        createdBy: new Types.ObjectId(user.id),
      });
      await logActivity(user, "create", "service", service.name, service._id);
      return NextResponse.json({ service: shape(service) }, { status: 201 });
    } catch (err) {
      if (isDuplicateKeyError(err))
        return jsonError("A service with this name already exists.");
      throw err;
    }
  });
}
