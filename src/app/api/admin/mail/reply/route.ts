import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { InboundEmail } from "@/models/InboundEmail";
import { jsonError, readBody, requireSuperadmin, withApi } from "@/lib/api-helpers";
import { CONTACT_EMAIL, isMailConfigured, sendMail } from "@/lib/mail";
import { SentEmail } from "@/models/SentEmail";

/** Reply to a mailbox message. The sender's answer goes to CONTACT_EMAIL when
 *  it is set; forward that inbox to POST /api/mail/inbound and it lands back
 *  in this mailbox. */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    await requireSuperadmin();
    const body = await readBody(req);
    const id = String(body.id ?? "");
    const text = String(body.text ?? "").trim();
    if (!Types.ObjectId.isValid(id)) return jsonError("Email not found.", 404);
    if (!text) return jsonError("Write a reply first.");
    if (!isMailConfigured()) return jsonError("Email is not configured.", 503);

    await connectDb();
    const original = await InboundEmail.findById(id);
    if (!original) return jsonError("Email not found.", 404);

    const subject = /^re:/i.test(original.subject)
      ? original.subject
      : `Re: ${original.subject}`;
    await sendMail({
      to: original.from,
      subject,
      text,
      ...(CONTACT_EMAIL ? { replyTo: CONTACT_EMAIL } : {}),
    });

    original.replies.push({ text, sentAt: new Date() });
    original.read = true;
    await original.save();
    await SentEmail.create({
      to: original.from,
      subject,
      text,
      kind: "reply",
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  });
}
