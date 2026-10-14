import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { parseAudience, resolveAudience } from "@/lib/announcement-audience";

/** "Who will get this?" — counts and a sample of names for an audience choice. */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("announcements");
    const body = await readBody(req);

    const audience = parseAudience(body);
    if ("error" in audience) return jsonError(audience.error);

    await connectDb();
    const resolved = await resolveAudience(user.churchId, audience);
    if ("error" in resolved) return jsonError(resolved.error);

    const withEmail = resolved.people.filter((p) => p.email).length;
    return NextResponse.json({
      recipients: resolved.people.length,
      withEmail,
      withoutEmail: resolved.people.length - withEmail,
      groupName: resolved.groupName,
      sample: resolved.people.slice(0, 10).map((p) => p.name),
    });
  });
}
