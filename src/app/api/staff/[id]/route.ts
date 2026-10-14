import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Staff } from "@/models/Staff";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { pickStaffFields } from "@/lib/staff-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("staff");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Staff member not found.", 404);

    await connectDb();
    const staff = await Staff.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!staff) return jsonError("Staff member not found.", 404);

    const linked = staff.person
      ? await Person.findOne({ _id: staff.person, churchId: user.churchId })
          .select("name memberNo")
          .lean()
      : null;

    return NextResponse.json({
      staff: {
        ...staff,
        _id: String(staff._id),
        person: linked ? String(staff.person) : null,
        personName: linked?.name ?? "",
        personMemberNo: linked?.memberNo ?? "",
      },
    });
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("staff");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Staff member not found.", 404);
    const body = await readBody(req);

    const picked = pickStaffFields(body);
    if (!picked.ok) return jsonError(picked.error);
    const update = picked.update;

    await connectDb();
    if (update.person) {
      const p = await Person.findOne({ _id: update.person, churchId: user.churchId })
        .select("_id")
        .lean();
      if (!p) return jsonError("The linked person was not found.");
    }

    const staff = await Staff.findOneAndUpdate(
      { _id: id, churchId: user.churchId },
      update,
      { new: true, runValidators: true }
    ).lean();
    if (!staff) return jsonError("Staff member not found.", 404);

    await logActivity(user, "update", "staff", `${staff.name} (${staff.staffNo})`, id);

    return NextResponse.json({ staff: { ...staff, _id: String(staff._id) } });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("staff");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Staff member not found.", 404);

    await connectDb();
    const staff = await Staff.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!staff) return jsonError("Staff member not found.", 404);
    await moveToRecycleBin({
      user,
      itemType: "staff",
      label: `${staff.name} (${staff.staffNo})`,
      doc: staff,
    });
    await Staff.deleteOne({ _id: id, churchId: user.churchId });

    return NextResponse.json({ ok: true });
  });
}
