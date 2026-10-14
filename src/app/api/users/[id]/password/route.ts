import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { jsonError, readBody, requireChurchAdmin, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity } from "@/lib/audit";
import { MIN_PASSWORD_LENGTH } from "@/lib/users-admin";

type Params = { params: Promise<{ id: string }> };

/** Give someone a fresh temporary password. They'll be asked to choose
 *  their own the next time they sign in. */
export async function POST(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurchAdmin();
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("User not found.", 404);
    const body = await readBody(req);
    const password = String(body.password ?? "");
    if (password.length < MIN_PASSWORD_LENGTH)
      return jsonError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

    await connectDb();
    const target = await User.findOne({ _id: id, churchId: user.churchId });
    if (!target) return jsonError("User not found.", 404);
    if (target.role === "superadmin")
      return jsonError("Company admins are managed from the Company console.", 403);
    if (target.isOwner)
      return jsonError("Owners reset their own password from My profile.");
    if (String(target._id) === user.id)
      return jsonError("Change your own password from My profile.");

    target.passwordHash = await bcrypt.hash(password, 10);
    target.mustChangePassword = true;
    // Every session minted with the old password stops working right now
    target.sessionVersion = (target.sessionVersion ?? 0) + 1;
    // Any emailed reset link they had is now moot
    target.resetTokenHash = null;
    target.resetTokenExpires = null;
    await target.save();

    await logActivity(user, "update", "user", `Password reset for ${target.name}`, target._id);

    return NextResponse.json({ ok: true });
  });
}
