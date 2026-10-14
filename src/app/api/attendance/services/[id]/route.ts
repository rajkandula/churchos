import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Service } from "@/models/Service";
import { Attendance } from "@/models/Attendance";
import { CheckIn } from "@/models/CheckIn";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { isDuplicateKeyError, pickServiceFields } from "@/lib/attendance-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("attendance");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Service not found.", 404);
    const body = await readBody(req);

    const picked = pickServiceFields(body);
    if (!picked.ok) return jsonError(picked.error);

    await connectDb();
    try {
      const service = await Service.findOneAndUpdate(
        { _id: id, churchId: user.churchId },
        picked.data,
        { new: true, runValidators: true }
      ).lean();
      if (!service) return jsonError("Service not found.", 404);
      await logActivity(user, "update", "service", service.name, id);
      return NextResponse.json({
        service: { ...service, _id: String(service._id) },
      });
    } catch (err) {
      if (isDuplicateKeyError(err))
        return jsonError("A service with this name already exists.");
      throw err;
    }
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("attendance");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Service not found.", 404);

    await connectDb();
    const service = await Service.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!service) return jsonError("Service not found.", 404);

    const [attendanceCount, checkInCount] = await Promise.all([
      Attendance.countDocuments({ churchId: user.churchId, service: id }),
      CheckIn.countDocuments({ churchId: user.churchId, service: id }),
    ]);
    if (attendanceCount > 0 || checkInCount > 0)
      return jsonError(
        `${service.name} has ${attendanceCount + checkInCount} attendance record${
          attendanceCount + checkInCount === 1 ? "" : "s"
        } and cannot be deleted. Deactivate instead.`
      );

    await moveToRecycleBin({
      user,
      itemType: "service",
      label: service.name,
      doc: service,
    });
    await Service.deleteOne({ _id: id, churchId: user.churchId });
    return NextResponse.json({ ok: true });
  });
}
