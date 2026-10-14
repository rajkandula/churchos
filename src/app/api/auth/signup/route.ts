import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { Church } from "@/models/Church";
import { setSessionCookie } from "@/lib/auth";
import { appOrigin, jsonError, readBody, withApi } from "@/lib/api-helpers";
import { emailTemplate, isMailConfigured, sendMail } from "@/lib/mail";

const USERNAME_RE = /^[a-z0-9._]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const body = await readBody(req);
    const churchName = String(body.churchName ?? "").trim();
    const name = String(body.name ?? "").trim();
    const username = String(body.username ?? "").trim().toLowerCase();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");

    if (!churchName) return jsonError("Please enter your church's name.");
    if (!name) return jsonError("Please enter your full name.");
    if (!USERNAME_RE.test(username))
      return jsonError(
        "Username must be 3–30 characters — lowercase letters, numbers, dots or underscores."
      );
    if (!EMAIL_RE.test(email)) return jsonError("Please enter a valid email address.");
    if (password.length < 8)
      return jsonError("Password must be at least 8 characters.");
    if (password !== confirmPassword)
      return jsonError("Passwords do not match.");

    await connectDb();

    const existing = await User.findOne({
      $or: [{ username }, { email }],
    }).lean();
    if (existing) {
      return jsonError(
        existing.username === username
          ? "That username is already taken."
          : "An account with that email already exists.",
        409
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Bootstrap: the very first account becomes the approved company admin.
    // Everyone after that waits for approval.
    const isFirstUser = (await User.countDocuments()) === 0;
    // Every signup starts its own church — records never cross churches.
    const church = await Church.create({ name: churchName });
    const user = await User.create({
      name,
      username,
      email,
      passwordHash,
      churchName,
      churchId: church._id,
      isOwner: true,
      role: isFirstUser ? "superadmin" : "admin",
      status: isFirstUser ? "approved" : "pending",
    });

    await setSessionCookie({
      id: user._id.toString(),
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      churchName: user.churchName,
      // Every mint carries the revocation counter, or the guards read this
      // brand-new cookie as stale on the very next request.
      sv: user.sessionVersion ?? 0,
    });

    if (isMailConfigured()) {
      if (isFirstUser) {
        sendMail({
          to: email,
          subject: `Welcome to ChurchOS, ${name.split(" ")[0]}`,
          text: `Hi ${name},\n\nYour ChurchOS admin account for ${churchName} is ready.\nUsername: ${username}\n\n— ChurchOS`,
          html: emailTemplate({
            heading: `Welcome to ChurchOS, ${name.split(" ")[0]}!`,
            bodyLines: [
              `Your ChurchOS admin account for ${churchName} is ready.`,
              `Your username is “${username}”.`,
            ],
            ctaLabel: "Open ChurchOS",
            ctaUrl: `${appOrigin(req)}/login`,
          }),
        }).catch((err) => console.warn("Welcome email failed:", err));
      } else {
        // Tell every company admin someone is waiting at the door
        const admins = await User.find({ role: "superadmin" })
          .select("email")
          .lean();
        for (const admin of admins) {
          if (!admin.email) continue;
          sendMail({
            to: admin.email,
            subject: `Approval needed: ${name} (${churchName}) signed up`,
            text: `${name} (${email}) from “${churchName}” registered on ChurchOS and is awaiting your approval.\n\nOpen the Company console to approve or reject.`,
            html: emailTemplate({
              heading: "New registration awaiting approval",
              bodyLines: [
                `${name} — ${churchName}`,
                `${email} · username “${username}”`,
                "They can't access anything until you approve them.",
              ],
              ctaLabel: "Open Company console",
              ctaUrl: `${appOrigin(req)}/admin`,
            }),
          }).catch((err) => console.warn("Approval notification failed:", err));
        }
      }
    }

    return NextResponse.json(
      { ok: true, status: user.status },
      { status: 201 }
    );
  });
}
