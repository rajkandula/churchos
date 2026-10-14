import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { AnnouncementTemplate } from "@/models/AnnouncementTemplate";
import { jsonError, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/** Only a church's own saved templates can go — the built-in starters are
 *  code, not data, and are always there. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("announcements");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Template not found.", 404);

    await connectDb();
    const template = await AnnouncementTemplate.findOne({
      _id: id,
      churchId: user.churchId,
    }).lean();
    if (!template) return jsonError("Template not found.", 404);

    await AnnouncementTemplate.deleteOne({ _id: id, churchId: user.churchId });
    await logActivity(
      user,
      "delete",
      "announcement",
      `Template: ${template.name}`,
      id
    );

    return NextResponse.json({ ok: true });
  });
}
