import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { InboundEmail } from "@/models/InboundEmail";
import { SentEmail } from "@/models/SentEmail";
import { jsonError, readBody, requireSuperadmin, withApi } from "@/lib/api-helpers";
import { CONTACT_EMAIL } from "@/lib/mail";

/** The company mailbox — mail received through the inbound-mail webhook. */
export async function GET() {
  return withApi(async () => {
    await requireSuperadmin();
    await connectDb();
    const emails = await InboundEmail.find()
      .sort({ receivedAt: -1 })
      .limit(100)
      .select("-html")
      .lean();
    const unread = await InboundEmail.countDocuments({ read: false });
    const sent = await SentEmail.find()
      .sort({ sentAt: -1 })
      .limit(100)
      .lean();
    return NextResponse.json({
      emails,
      unread,
      sent,
      mailbox: CONTACT_EMAIL,
      inboundEnabled: Boolean(process.env.INBOUND_MAIL_SECRET),
    });
  });
}

export async function PATCH(req: NextRequest) {
  return withApi(async () => {
    await requireSuperadmin();
    const body = await readBody(req);
    const id = String(body.id ?? "");
    if (!Types.ObjectId.isValid(id)) return jsonError("Email not found.", 404);
    await connectDb();
    await InboundEmail.updateOne(
      { _id: id },
      { $set: { read: Boolean(body.read) } }
    );
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: NextRequest) {
  return withApi(async () => {
    await requireSuperadmin();
    const body = await readBody(req);
    const id = String(body.id ?? "");
    if (!Types.ObjectId.isValid(id)) return jsonError("Email not found.", 404);
    await connectDb();
    await InboundEmail.deleteOne({ _id: id });
    return NextResponse.json({ ok: true });
  });
}
