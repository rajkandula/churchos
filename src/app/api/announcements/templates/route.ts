import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { AnnouncementTemplate } from "@/models/AnnouncementTemplate";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { logActivity } from "@/lib/audit";
import { isHttpUrl } from "@/lib/announcement-dispatch";
import { BUILT_IN_TEMPLATES } from "@/lib/announcement-templates";

function shapeTemplate(t: Record<string, unknown>) {
  return {
    _id: String(t._id),
    name: (t.name as string) ?? "",
    description: (t.description as string) ?? "",
    title: (t.title as string) ?? "",
    body: (t.body as string) ?? "",
    ctaLabel: (t.ctaLabel as string) ?? "",
    ctaUrl: (t.ctaUrl as string) ?? "",
    category: (t.category as string) || "Custom",
  };
}

/** The starter set plus whatever this church has saved for itself. */
export async function GET() {
  return withApi(async () => {
    const user = await requireChurch("announcements");
    await connectDb();
    const saved = await AnnouncementTemplate.find({ churchId: user.churchId })
      .sort({ category: 1, name: 1 })
      .limit(200)
      .lean();
    return NextResponse.json({
      builtIn: BUILT_IN_TEMPLATES,
      saved: saved.map((t) => shapeTemplate(t)),
    });
  });
}

/** Save the announcement being written as a reusable template. */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("announcements");
    const body = await readBody(req);

    const name = String(body.name ?? "").trim().slice(0, 80);
    if (!name) return jsonError("Give the template a name.");
    const title = String(body.title ?? "").trim().slice(0, 200);
    if (!title) return jsonError("A template needs a subject line.");
    const text = String(body.body ?? "").replace(/\r\n/g, "\n").trim();
    if (text.length > 20000)
      return jsonError("The template is too long (max 20,000 characters).");
    const ctaUrl = String(body.ctaUrl ?? "").trim();
    if (ctaUrl && !isHttpUrl(ctaUrl))
      return jsonError("The button link must start with http:// or https://.");

    await connectDb();
    const existing = await AnnouncementTemplate.findOne({
      churchId: user.churchId,
      name,
    }).lean();
    if (existing)
      return jsonError("You already have a template with that name.");

    const template = await AnnouncementTemplate.create({
      churchId: user.churchId,
      name,
      description: String(body.description ?? "").trim().slice(0, 200),
      title,
      body: text,
      ctaLabel: String(body.ctaLabel ?? "").trim().slice(0, 60),
      ctaUrl,
      category: String(body.category ?? "").trim().slice(0, 40) || "Custom",
      createdBy: new Types.ObjectId(user.id),
    });

    await logActivity(
      user,
      "create",
      "announcement",
      `Template: ${name}`,
      template._id
    );

    return NextResponse.json(
      { template: shapeTemplate(template.toObject()) },
      { status: 201 }
    );
  });
}
