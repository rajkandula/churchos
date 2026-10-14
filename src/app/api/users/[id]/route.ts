import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { Role } from "@/models/Role";
import { jsonError, readBody, requireChurchAdmin, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";
import { EMAIL_MESSAGE, EMAIL_RE, EMAIL_TAKEN, shapeUser } from "@/lib/users-admin";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurchAdmin();
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("User not found.", 404);
    const body = await readBody(req);

    await connectDb();
    const target = await User.findOne({ _id: id, churchId: user.churchId });
    if (!target) return jsonError("User not found.", 404);
    // A company admin who happens to belong to this church is not the
    // church's to edit — otherwise a church admin could take the console over.
    if (target.role === "superadmin")
      return jsonError("Company admins are managed from the Company console.", 403);

    const isYou = String(target._id) === user.id;
    const wantsRole = body.roleId !== undefined;
    const wantsStatus = body.status !== undefined;

    // The owner is untouchable: nobody changes their role or status, and
    // only they can edit their own name/email.
    if (target.isOwner) {
      if (!isYou) return jsonError("Only the owner can edit the owner's account.", 403);
      if (wantsRole || wantsStatus)
        return jsonError("The owner always has every app and can't be disabled.");
    }
    if (isYou) {
      const currentRole = target.churchRole ? String(target.churchRole) : "";
      if (wantsRole && String(body.roleId ?? "") !== currentRole)
        return jsonError("You can't change your own role — ask another admin to do it.");
      if (wantsStatus && body.status !== "approved")
        return jsonError("You can't disable your own account.");
    }

    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) return jsonError("Name cannot be empty.");
      target.name = name;
    }
    if (body.email !== undefined) {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return jsonError(EMAIL_MESSAGE);
      const clash = await User.findOne({ _id: { $ne: target._id }, email })
        .select("_id")
        .lean();
      if (clash) return jsonError(EMAIL_TAKEN, 409);
      target.email = email;
    }

    const roleNames = new Map<string, string>();
    if (wantsRole) {
      const roleId = String(body.roleId ?? "").trim();
      if (!roleId || !isValidObjectId(roleId)) return jsonError("Please choose a role.");
      const role = await Role.findOne({ _id: roleId, churchId: user.churchId })
        .select("name")
        .lean();
      if (!role) return jsonError("Role not found.");
      target.churchRole = role._id;
      roleNames.set(String(role._id), role.name);
    }
    if (wantsStatus) {
      const status =
        body.status === "approved" ? "approved" : body.status === "disabled" ? "disabled" : null;
      if (!status) return jsonError("Status must be approved or disabled.");
      // "pending" and "rejected" belong to the company admin — a church admin
      // must not be able to wave an account past that hold.
      const current = target.status ?? "approved";
      if (current !== "approved" && current !== "disabled")
        return jsonError("This account is on hold by the company admin.");
      target.status = status;
      // Disabling has to bite immediately, not when their cookie expires.
      if (status === "disabled") target.sessionVersion = (target.sessionVersion ?? 0) + 1;
    }

    await target.save();
    await logActivity(user, "update", "user", `${target.name} (${target.username})`, target._id);

    if (target.churchRole && !roleNames.has(String(target.churchRole))) {
      const role = await Role.findOne({ _id: target.churchRole, churchId: user.churchId })
        .select("name")
        .lean();
      if (role) roleNames.set(String(role._id), role.name);
    }

    return NextResponse.json({ user: shapeUser(target.toObject(), roleNames, user.id) });
  });
}

/** Remove a sign-in for good (it lands in the Recycle Bin). Only disabled
 *  accounts can go, so nobody is locked out by a slip of the mouse. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurchAdmin();
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("User not found.", 404);

    await connectDb();
    const target = await User.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!target) return jsonError("User not found.", 404);
    if (target.role === "superadmin")
      return jsonError("Company admins are managed from the Company console.", 403);
    if (target.isOwner) return jsonError("The owner's account can't be removed.");
    if (String(target._id) === user.id) return jsonError("You can't remove your own account.");
    if (target.status !== "disabled")
      return jsonError("Disable the account first, then remove it.");

    await moveToRecycleBin({
      user,
      itemType: "user",
      label: `${target.name} (${target.username})`,
      doc: target,
    });
    await User.deleteOne({ _id: id, churchId: user.churchId });

    return NextResponse.json({ ok: true });
  });
}
