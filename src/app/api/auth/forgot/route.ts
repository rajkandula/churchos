import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { appOrigin, jsonError, readBody, withApi } from "@/lib/api-helpers";
import { emailTemplate, sendMail } from "@/lib/mail";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
/** One mail per address per this long. The freshness of the token already on
 *  the account is the clock, so this needs no extra field. */
const RESEND_COOLDOWN_MS = 15 * 60 * 1000;
/** Every answer takes at least this long, so the time on the wire doesn't
 *  say whether an account was found, written to and emailed. */
const MIN_RESPONSE_MS = 700;

async function padTo(startedAt: number): Promise<void> {
  const remaining = MIN_RESPONSE_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
}

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const startedAt = Date.now();
    const body = await readBody(req);
    const identifier = String(body.identifier ?? "").trim().toLowerCase();
    if (!identifier)
      return jsonError("Please enter your username or email.");

    await connectDb();
    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });

    // Same response whether the account is missing or blocked — no enumeration.
    // (A blocked account gets no token at all, so a stale link can't revive it.)
    if (!user || user.status === "disabled" || user.status === "rejected") {
      await padTo(startedAt);
      return NextResponse.json({ ok: true });
    }

    // A token minted less than the cooldown ago still works, so mint nothing
    // and send nothing. The response and its timing are unchanged, so this
    // branch is invisible from the outside.
    if (
      user.resetTokenExpires &&
      user.resetTokenExpires.getTime() - Date.now() >
        RESET_TOKEN_TTL_MS - RESEND_COOLDOWN_MS
    ) {
      await padTo(startedAt);
      return NextResponse.json({ ok: true });
    }

    const token = randomBytes(32).toString("hex");
    user.resetTokenHash = createHash("sha256").update(token).digest("hex");
    user.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const resetUrl = `${appOrigin(req)}/reset-password?token=${token}`;
    try {
      await sendMail({
        to: user.email,
        subject: "Reset your ChurchOS password",
        text: [
          `Hi ${user.name},`,
          "",
          "We received a request to reset your ChurchOS password.",
          "Open this link to choose a new one (valid for 1 hour):",
          "",
          resetUrl,
          "",
          "If you didn't request this, you can safely ignore this email —",
          "your password will stay unchanged.",
          "",
          "— ChurchOS",
        ].join("\n"),
        html: emailTemplate({
          heading: "Reset your password",
          bodyLines: [
            `Hi ${user.name},`,
            "We received a request to reset your ChurchOS password. Click the button below to choose a new one. The link is valid for 1 hour.",
          ],
          ctaLabel: "Reset password",
          ctaUrl: resetUrl,
          footerNote:
            "If you didn't request this, you can safely ignore this email — your password will stay unchanged.",
        }),
      });
    } catch (err) {
      // A send failure must not be visible: a 500 here would tell the caller
      // the address belongs to a real account. Log it and answer as usual.
      console.error("Password reset email failed:", err);
    }

    await padTo(startedAt);
    return NextResponse.json({ ok: true });
  });
}
