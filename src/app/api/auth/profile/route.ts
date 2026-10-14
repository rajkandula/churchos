import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { setSessionCookie } from "@/lib/auth";
import { jsonError, readBody, requireSession, withApi } from "@/lib/api-helpers";

const USERNAME_RE = /^[a-z0-9._]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  return withApi(async () => {
    const session = await requireSession();
    await connectDb();
    const user = await User.findById(session.id).lean();
    if (!user) return jsonError("Account not found.", 404);
    return NextResponse.json({
      profile: {
        name: user.name,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
      // Still on the temporary password the church admin issued — the page
      // shows the "set your own password" banner until this turns false.
      mustChangePassword: user.mustChangePassword === true,
    });
  });
}

export async function PATCH(req: NextRequest) {
  return withApi(async () => {
    const session = await requireSession();
    const body = await readBody(req);

    const name = String(body.name ?? "").trim();
    const username = String(body.username ?? "").trim().toLowerCase();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!name) return jsonError("Please enter your full name.");
    if (!USERNAME_RE.test(username))
      return jsonError(
        "Username must be 3–30 characters — lowercase letters, numbers, dots or underscores."
      );
    if (!EMAIL_RE.test(email))
      return jsonError("Please enter a valid email address.");

    await connectDb();

    const clash = await User.findOne({
      _id: { $ne: session.id },
      $or: [{ username }, { email }],
    }).lean();
    if (clash) {
      return jsonError(
        clash.username === username
          ? "That username is already taken."
          : "An account with that email already exists.",
        409
      );
    }

    const user = await User.findByIdAndUpdate(
      session.id,
      { name, username, email },
      { new: true, runValidators: true }
    );
    if (!user) return jsonError("Account not found.", 404);

    // Session claims changed — re-issue the cookie, carrying the account's
    // current session version so the new token isn't treated as stale.
    await setSessionCookie({
      id: user._id.toString(),
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      churchName: user.churchName ?? "",
      sv: user.sessionVersion ?? 0,
    });

    return NextResponse.json({ ok: true });
  });
}
