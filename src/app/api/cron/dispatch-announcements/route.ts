import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, withApi } from "@/lib/api-helpers";
import { dispatchDueAnnouncements } from "@/lib/announcement-dispatch";
import { secretsMatch } from "@/lib/shared-secret";

// Never cached, never prerendered: this runs on the clock, not on a build.
export const dynamic = "force-dynamic";

/**
 * Send every scheduled announcement that has come due — across all churches.
 *
 * The server already does this every five minutes by itself
 * (src/lib/announcement-scheduler.ts). This route is for an external
 * scheduler — useful when the host stops idle servers — and is the one route
 * with no session: call it with the shared secret in the `x-cron-secret`
 * header. Without a matching `CRON_SECRET` it answers 404 like any other
 * unknown path, so the endpoint gives away nothing to a prober.
 */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const secret = process.env.CRON_SECRET ?? "";
    const offered = req.headers.get("x-cron-secret") ?? "";
    if (!secret || !secretsMatch(secret, offered))
      return jsonError("Not found.", 404);

    await connectDb();
    const { dispatched, failed } = await dispatchDueAnnouncements();
    return NextResponse.json({ dispatched, failed });
  });
}
