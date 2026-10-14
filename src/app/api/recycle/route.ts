import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { RecycleItem } from "@/models/RecycleItem";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { logActivity, restoreFromRecycleBin } from "@/lib/audit";
import { canManageUsers, canOpen } from "@/lib/access";
import type { AppKey } from "@/lib/apps";

/**
 * Which app owns each kind of deleted record. The Recycle Bin app only
 * grants you the bin itself — what you may see, restore or purge in it is
 * still decided by the apps your role can open.
 */
const ITEM_TYPE_APP: Record<string, AppKey> = {
  person: "people",
  household: "people",
  donation: "giving",
  fund: "giving",
  pledge: "giving",
  service: "attendance",
  attendance: "attendance",
  checkIn: "attendance",
  group: "groups",
  event: "events",
  registration: "events",
  servicePlan: "services",
  team: "services",
  announcement: "announcements",
  certificate: "certificates",
  connectCard: "connect",
  staff: "staff",
  driveItem: "drive",
  role: "users",
  user: "users",
};

const NO_APP_ACCESS = "You don't have access to the app this item belongs to.";

/** Restore failures on a unique index, said the way each item type needs. */
function duplicateMessage(itemType: string): string {
  if (itemType === "user") return "That username or email is now used by another account.";
  if (itemType === "role") return "A role with that name already exists.";
  return "A record with the same number already exists — restore blocked to avoid duplicates.";
}

export async function GET() {
  return withApi(async () => {
    const user = await requireChurch("recycle");
    await connectDb();
    // Fail closed: an unmapped item type belongs to no app anyone can open.
    const allowed = Object.keys(ITEM_TYPE_APP).filter((type) =>
      canOpen(user.access, ITEM_TYPE_APP[type])
    );
    const items = await RecycleItem.find({
      churchId: user.churchId,
      itemType: { $in: allowed },
    })
      .sort({ deletedAt: -1 })
      .limit(200)
      .select("-data -related")
      .lean();
    return NextResponse.json({ items });
  });
}

/** action: "restore" puts the record back; "purge" removes it forever. */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("recycle");
    const body = await readBody(req);
    const id = String(body.id ?? "");
    const action = String(body.action ?? "");
    if (!Types.ObjectId.isValid(id)) return jsonError("Item not found.", 404);

    await connectDb();
    const item = await RecycleItem.findOne({
      _id: id,
      churchId: user.churchId,
    }).lean();
    if (!item) return jsonError("Item not found.", 404);

    const app = ITEM_TYPE_APP[item.itemType];
    if (!app || !canOpen(user.access, app)) return jsonError(NO_APP_ACCESS, 403);
    const isAccount = item.itemType === "user" || item.itemType === "role";
    if (isAccount && !canManageUsers(user.access)) return jsonError(NO_APP_ACCESS, 403);

    if (action === "restore") {
      const data = { ...(item.data as Record<string, unknown>) };
      let message: string | undefined;
      if (item.itemType === "user") {
        // A sign-in never comes back with the privileges it had: it returns
        // disabled, ordinary, and with every old session token invalidated.
        const previousVersion =
          typeof data.sessionVersion === "number" ? data.sessionVersion : 0;
        data.isOwner = false;
        data.role = "admin";
        data.status = "disabled";
        data.mustChangePassword = true;
        data.sessionVersion = previousVersion + 1;
        message = "Restored as a disabled account — re-enable it from Users & roles.";
      }
      try {
        await restoreFromRecycleBin({
          itemType: item.itemType,
          data,
          related: item.related as {
            collection: string;
            docs: Record<string, unknown>[];
          } | null,
        });
      } catch (err) {
        if ((err as { code?: number }).code === 11000)
          return jsonError(duplicateMessage(item.itemType));
        throw err;
      }
      await RecycleItem.deleteOne({ _id: id });
      await logActivity(user, "restore", item.itemType, item.label, data._id);
      return NextResponse.json({ ok: true, restored: true, message });
    }

    if (action === "purge") {
      await RecycleItem.deleteOne({ _id: id });
      return NextResponse.json({ ok: true, purged: true });
    }

    return jsonError("Unknown action.");
  });
}
