import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { ContactMessage } from "@/models/ContactMessage";
import { jsonError, readBody, requireSuperadmin, withApi } from "@/lib/api-helpers";

export async function GET() {
  return withApi(async () => {
    await requireSuperadmin();
    await connectDb();
    const messages = await ContactMessage.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return NextResponse.json({
      messages: messages.map((m) => ({ ...m, _id: String(m._id) })),
    });
  });
}

export async function PATCH(req: NextRequest) {
  return withApi(async () => {
    await requireSuperadmin();
    const body = await readBody(req);
    const id = String(body.id ?? "");
    if (!Types.ObjectId.isValid(id)) return jsonError("Message not found.", 404);
    const status = body.status === "handled" ? "handled" : "new";

    await connectDb();
    const message = await ContactMessage.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).lean();
    if (!message) return jsonError("Message not found.", 404);
    return NextResponse.json({ ok: true });
  });
}
