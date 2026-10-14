import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Event } from "@/models/Event";
import { jsonError, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { ensureChurchCode } from "@/lib/public-church";
import { ensureEventSlug } from "@/lib/events";

type Params = { params: Promise<{ id: string }> };

/** The no-login registration link: /register/<church code>/<event slug>. */
export async function GET(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("events");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Event not found.", 404);

    await connectDb();
    const event = await Event.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!event) return jsonError("Event not found.", 404);

    const code = await ensureChurchCode(user.churchId);
    const slug = await ensureEventSlug(event);

    // APP_URL when set; otherwise, behind a proxy or load balancer, the public
    // host arrives in forwarded headers
    const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
    const configured = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
    const origin = configured || `${proto}://${host}`;

    return NextResponse.json({
      url: `${origin}/register/${encodeURIComponent(code)}/${slug}`,
      code,
      slug,
    });
  });
}
