import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { setSessionCookie } from "@/lib/auth";
import { jsonError, readBody, requireSession, withApi } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const session = await requireSession();
    const body = await readBody(req);
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");

    if (!currentPassword)
      return jsonError("Please enter your current password.");
    if (newPassword.length < 8)
      return jsonError("New password must be at least 8 characters.");
    if (newPassword !== confirmPassword)
      return jsonError("New passwords do not match.");

    await connectDb();
    const user = await User.findById(session.id);
    if (!user) return jsonError("Account not found.", 404);

    if (!(await bcrypt.compare(currentPassword, user.passwordHash)))
      return jsonError("Your current password is incorrect.", 401);

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    // A temporary password (set by the church admin) has now been replaced
    user.mustChangePassword = false;
    // Every token minted before this moment carries the old version and is
    // rejected from here on — every other device is signed out.
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    // Any emailed reset link they had is moot now
    user.resetTokenHash = null;
    user.resetTokenExpires = null;
    await user.save();

    // …except this browser: re-issue its cookie with the new version so the
    // person who just changed their password stays signed in.
    await setSessionCookie({
      id: user._id.toString(),
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      churchName: user.churchName ?? "",
      sv: user.sessionVersion,
    });

    return NextResponse.json({ ok: true });
  });
}
