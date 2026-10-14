import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { setSessionCookie } from "@/lib/auth";
import { jsonError, readBody, withApi } from "@/lib/api-helpers";

/** Wrong passwords past this many earn a lockout. */
const LOCK_AFTER_FAILURES = 5;
/** The first lockout, doubling per further failure up to LOCK_MAX_STEPS. */
const LOCK_STEP_MS = 30_000;
const LOCK_MAX_STEPS = 32; // ~16 minutes, then it stops growing

const BAD_CREDENTIALS = "Incorrect username/email or password.";

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const body = await readBody(req);
    const identifier = String(body.identifier ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!identifier || !password)
      return jsonError("Please enter your username/email and password.");

    await connectDb();

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });
    if (!user) return jsonError(BAD_CREDENTIALS, 401);

    // A locked account is refused before bcrypt runs, so guessing costs the
    // attacker a wait instead of our CPU. Same message either way — the
    // lockout tells the caller nothing the wrong password didn't already.
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      return jsonError(BAD_CREDENTIALS, 401);
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      const failures = (user.failedLoginCount ?? 0) + 1;
      user.failedLoginCount = failures;
      if (failures > LOCK_AFTER_FAILURES) {
        // Time-bounded and self-clearing: a permanent lock would hand an
        // attacker a way to lock any known account out for good.
        const steps = Math.min(2 ** (failures - LOCK_AFTER_FAILURES), LOCK_MAX_STEPS);
        user.lockedUntil = new Date(Date.now() + steps * LOCK_STEP_MS);
      }
      await user.save();
      return jsonError(BAD_CREDENTIALS, 401);
    }

    if (user.status === "disabled") {
      return jsonError(
        "This account has been disabled. Contact your church admin.",
        403
      );
    }
    if (user.status === "rejected") {
      return jsonError(
        "This registration was not approved. Contact the administrator if you believe this is a mistake.",
        403
      );
    }

    user.lastLoginAt = new Date();
    user.failedLoginCount = 0;
    user.lockedUntil = null;
    await user.save();

    await setSessionCookie({
      id: user._id.toString(),
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      churchName: user.churchName ?? "",
      // The guards compare this against User.sessionVersion — a token minted
      // without it would be treated as stale on the very next request.
      sv: user.sessionVersion ?? 0,
    });

    return NextResponse.json({
      ok: true,
      status: user.status ?? "approved",
      // Accounts created by a church admin sign in with a temporary password
      mustChangePassword: user.mustChangePassword === true,
    });
  });
}
