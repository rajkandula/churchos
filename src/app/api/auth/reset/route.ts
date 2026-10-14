import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { jsonError, readBody, withApi } from "@/lib/api-helpers";

/** One message for every failure — a bad token, an expired token and a
 *  blocked account must be indistinguishable from the outside. */
const INVALID_LINK =
  "This reset link is invalid or has expired. Please request a new one.";

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const body = await readBody(req);
    const token = String(body.token ?? "");
    const password = String(body.password ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");

    if (!token) return jsonError("This reset link is invalid.", 400);
    if (password.length < 8)
      return jsonError("Password must be at least 8 characters.");
    if (password !== confirmPassword)
      return jsonError("Passwords do not match.");

    await connectDb();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() },
    });
    // A disabled or rejected account gets the same answer as a bad token —
    // the link must never confirm that the account exists.
    if (!user || user.status === "disabled" || user.status === "rejected")
      return jsonError(INVALID_LINK, 400);

    user.passwordHash = await bcrypt.hash(password, 10);
    // A password chosen through the emailed link is the user's own, so the
    // temporary-password flag is satisfied.
    user.mustChangePassword = false;
    // Sign out every device that still holds a token from before the reset.
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    user.resetTokenHash = null;
    user.resetTokenExpires = null;
    // Choosing a new password ends any sign-in lockout — otherwise the one
    // recovery path a locked-out user has would still leave them locked out.
    user.failedLoginCount = 0;
    user.lockedUntil = null;
    await user.save();

    return NextResponse.json({ ok: true });
  });
}
