import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Role } from "@/models/Role";
import { User } from "@/models/User";
import { jsonError, readBody, requireChurchAdmin, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";
import { exactMatch, parseApps, shapeRole } from "@/lib/users-admin";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurchAdmin();
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Role not found.", 404);
    const body = await readBody(req);

    await connectDb();
    const role = await Role.findOne({ _id: id, churchId: user.churchId });
    if (!role) return jsonError("Role not found.", 404);

    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) return jsonError("Please give the role a name.");
      if (name.length > 60) return jsonError("Role names are limited to 60 characters.");
      const clash = await Role.findOne({
        _id: { $ne: role._id },
        churchId: user.churchId,
        name: exactMatch(name),
      })
        .select("_id")
        .lean();
      if (clash) return jsonError("A role with that name already exists.", 409);
      role.name = name;
    }
    if (body.description !== undefined) {
      role.description = String(body.description ?? "").trim();
    }
    if (body.apps !== undefined) {
      if (role.system) return jsonError("The Church admin role always has every app.");
      const parsed = parseApps(body.apps);
      if ("error" in parsed) return jsonError(parsed.error);
      // Dropping "users" from the role you yourself hold locks you out of the
      // only place that could put it back. The owner always has a way in.
      if (
        !user.access.isOwner &&
        user.access.roleId === String(role._id) &&
        !parsed.apps.includes("users")
      )
        return jsonError(
          "You can't remove Users & roles from your own role — ask another admin to do it."
        );
      role.apps = parsed.apps;
    }

    try {
      await role.save();
    } catch (err) {
      if ((err as { code?: number }).code === 11000)
        return jsonError("A role with that name already exists.", 409);
      throw err;
    }
    await logActivity(user, "update", "role", role.name, role._id);

    const userCount = await User.countDocuments({
      churchId: user.churchId,
      churchRole: role._id,
    });
    return NextResponse.json({
      role: shapeRole(role.toObject(), userCount, user.access.roleId),
    });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurchAdmin();
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Role not found.", 404);

    await connectDb();
    const role = await Role.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!role) return jsonError("Role not found.", 404);
    if (role.system) return jsonError("The built-in Church admin role can't be deleted.");

    const inUse = await User.countDocuments({
      churchId: user.churchId,
      churchRole: role._id,
    });
    if (inUse > 0)
      return jsonError(
        `Move its ${inUse} ${inUse === 1 ? "user" : "users"} to another role first.`
      );

    await moveToRecycleBin({ user, itemType: "role", label: role.name, doc: role });
    await Role.deleteOne({ _id: id, churchId: user.churchId });

    return NextResponse.json({ ok: true });
  });
}
