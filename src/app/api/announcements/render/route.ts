import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Church } from "@/models/Church";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isHttpUrl, normalizeTheme } from "@/lib/announcement-dispatch";
import {
  renderAnnouncementEmail,
  type EmailBranding,
} from "@/lib/email-render";

/** The live preview: exactly the email that would go out, under this church's
 *  own branding. Renders only — it never sends anything. */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("announcements");
    const body = await readBody(req);

    const title = String(body.title ?? "").trim() || "Your announcement";
    const text = String(body.body ?? "").replace(/\r\n/g, "\n").slice(0, 20000);
    const ctaLabel = String(body.ctaLabel ?? "").trim().slice(0, 60);
    const ctaUrl = String(body.ctaUrl ?? "").trim();
    if (ctaUrl && !isHttpUrl(ctaUrl))
      return jsonError("The button link must start with http:// or https://.");

    await connectDb();
    const church = await Church.findById(user.churchId)
      .select("name logoUrl address website pastorName")
      .lean();
    const branding: EmailBranding = {
      churchName: church?.name || "Your church",
      logoUrl: church?.logoUrl || undefined,
      address: church?.address || undefined,
      website: church?.website || undefined,
      pastorName: church?.pastorName || undefined,
    };

    const rendered = renderAnnouncementEmail({
      title,
      body: text,
      branding,
      ctaLabel: ctaLabel || undefined,
      ctaUrl: ctaUrl || undefined,
      theme: normalizeTheme(body.theme),
    });

    return NextResponse.json({ html: rendered.html, text: rendered.text });
  });
}
