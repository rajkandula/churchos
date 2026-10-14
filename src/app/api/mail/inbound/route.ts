import { NextRequest, NextResponse } from "next/server";
import PostalMime from "postal-mime";
import { connectDb } from "@/lib/db";
import { jsonError, withApi } from "@/lib/api-helpers";
import { secretsMatch } from "@/lib/shared-secret";
import { InboundEmail } from "@/models/InboundEmail";

// Never cached, never prerendered.
export const dynamic = "force-dynamic";

/** Generous for text mail, small enough that nobody can fill the database. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Inbound mail for the company console's Mailbox.
 *
 * Point any mail provider's "forward to webhook" feature (or your own relay)
 * at this route with the `x-inbound-secret` header set to INBOUND_MAIL_SECRET.
 * The body is either the raw RFC 822 message (any non-JSON content type) or
 * JSON `{ from, fromName?, to?, subject?, text?, html? }`.
 *
 * Without a matching INBOUND_MAIL_SECRET it answers 404 like any unknown path,
 * so the endpoint gives nothing away to a prober.
 */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const secret = process.env.INBOUND_MAIL_SECRET ?? "";
    const offered = req.headers.get("x-inbound-secret") ?? "";
    if (!secret || !secretsMatch(secret, offered))
      return jsonError("Not found.", 404);

    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) return jsonError("Message too large.", 413);
    const raw = await req.arrayBuffer();
    if (raw.byteLength > MAX_BYTES) return jsonError("Message too large.", 413);

    let mail: {
      from: string;
      fromName: string;
      to: string;
      subject: string;
      text: string;
      html: string;
    };

    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(new TextDecoder().decode(raw));
      } catch {
        return jsonError("Invalid JSON.");
      }
      mail = {
        from: String(body.from ?? "").trim(),
        fromName: String(body.fromName ?? ""),
        to: String(body.to ?? ""),
        subject: String(body.subject ?? "") || "(no subject)",
        text: String(body.text ?? ""),
        html: String(body.html ?? ""),
      };
    } else {
      const parsed = await PostalMime.parse(raw);
      mail = {
        from: parsed.from?.address ?? "",
        fromName: parsed.from?.name ?? "",
        to: (parsed.to ?? [])
          .map((a) => a.address ?? "")
          .filter(Boolean)
          .join(", "),
        subject: parsed.subject || "(no subject)",
        text: parsed.text ?? "",
        html: parsed.html ?? "",
      };
    }

    if (!mail.from) return jsonError("The message has no sender.");

    await connectDb();
    const saved = await InboundEmail.create({
      ...mail,
      read: false,
      replies: [],
      receivedAt: new Date(),
    });
    return NextResponse.json({ ok: true, id: String(saved._id) }, { status: 201 });
  });
}
