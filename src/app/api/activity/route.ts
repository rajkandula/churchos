import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ActivityLog } from "@/models/ActivityLog";
import { requireChurch, withApi } from "@/lib/api-helpers";
import { canOpen } from "@/lib/access";
import { ITEM_TYPE_APP_KEY } from "@/lib/audit-labels";

export async function GET() {
  return withApi(async () => {
    const user = await requireChurch("activity");
    await connectDb();
    // Fail closed: an unmapped item type belongs to no app anyone can open.
    const allowed = Object.keys(ITEM_TYPE_APP_KEY).filter((type) =>
      canOpen(user.access, ITEM_TYPE_APP_KEY[type])
    );
    const entries = await ActivityLog.find({
      churchId: user.churchId,
      itemType: { $in: allowed },
    })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    return NextResponse.json({ entries });
  });
}
