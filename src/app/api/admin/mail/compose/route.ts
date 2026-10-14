import { NextRequest, NextResponse } from "next/server";
import { jsonError, readBody, requireSuperadmin, withApi } from "@/lib/api-helpers";
import { CONTACT_EMAIL, isMailConfigured, sendMail } from "@/lib/mail";
import { connectDb } from "@/lib/db";
import { SentEmail } from "@/models/SentEmail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Compose a fresh email from the company console. Replies go to
 *  CONTACT_EMAIL when it is set. */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    await requireSuperadmin();
    const body = await readBody(req);
    const to = String(body.to ?? "").trim().toLowerCase();
    const subject = String(body.subject ?? "").trim();
    const text = String(body.text ?? "").trim();
    const html = body.html ? String(body.html) : undefined;

    if (!EMAIL_RE.test(to)) return jsonError("Enter a valid email address.");
    if (!subject) return jsonError("Enter a subject.");
    if (!text) return jsonError("Write the message.");
    if (!isMailConfigured()) return jsonError("Email is not configured.", 503);

    await sendMail({
      to,
      subject,
      text,
      ...(html ? { html } : {}),
      ...(CONTACT_EMAIL ? { replyTo: CONTACT_EMAIL } : {}),
    });

    await connectDb();
    await SentEmail.create({ to, subject, text, kind: "compose" }).catch(() => {});

    return NextResponse.json({ ok: true });
  });
}
