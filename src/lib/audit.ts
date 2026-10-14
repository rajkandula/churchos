import mongoose from "mongoose";
import { ActivityLog } from "@/models/ActivityLog";
import { RecycleItem } from "@/models/RecycleItem";
import type { ChurchSession } from "@/lib/api-helpers";

/** Which Mongo collection each recycle-bin item type restores into. */
export const RECYCLE_COLLECTIONS: Record<string, string> = {
  person: "people",
  household: "households",
  donation: "donations",
  fund: "funds",
  pledge: "pledges",
  service: "services",
  attendance: "attendances",
  checkIn: "checkins",
  group: "groups",
  event: "events",
  registration: "registrations",
  servicePlan: "serviceplans",
  team: "teams",
  announcement: "announcements",
  certificate: "certificates",
  connectCard: "connectcards",
  staff: "staffs",
  driveItem: "driveitems",
  role: "roles",
  user: "users",
};

export { ITEM_TYPE_LABELS, ITEM_TYPE_APPS } from "@/lib/audit-labels";

/** Record who changed what — never fails the request it decorates. */
export async function logActivity(
  user: ChurchSession,
  action: "create" | "update" | "delete" | "restore",
  itemType: string,
  label: string,
  itemId?: unknown
): Promise<void> {
  try {
    await ActivityLog.create({
      churchId: user.churchId,
      userId: user.id || undefined,
      userName: user.name,
      action,
      itemType,
      label,
      itemId: itemId ? String(itemId) : "",
    });
  } catch (err) {
    console.error("activity log failed:", err);
  }
}

/** Snapshot a document into the Recycle Bin before the route deletes it.
 *  Also writes the delete activity entry. */
export async function moveToRecycleBin({
  user,
  itemType,
  label,
  doc,
  related,
}: {
  user: ChurchSession;
  itemType: string;
  label: string;
  doc: Record<string, unknown> & { _id?: unknown };
  related?: { collection: string; docs: Record<string, unknown>[] } | null;
}): Promise<void> {
  await RecycleItem.create({
    churchId: user.churchId,
    itemType,
    label,
    data: doc,
    related: related ?? null,
    deletedBy: { id: user.id, name: user.name },
    deletedAt: new Date(),
  });
  await logActivity(user, "delete", itemType, label, doc._id);
}

/** Put a recycled document back into its original collection. */
export async function restoreFromRecycleBin(item: {
  itemType: string;
  data: Record<string, unknown>;
  related?: { collection: string; docs: Record<string, unknown>[] } | null;
}): Promise<void> {
  const collection = RECYCLE_COLLECTIONS[item.itemType];
  if (!collection) throw new Error("This item type cannot be restored.");
  const db = mongoose.connection.db!;
  await db.collection(collection).insertOne(
    item.data as Parameters<
      ReturnType<typeof db.collection>["insertOne"]
    >[0]
  );
  if (item.related?.collection && item.related.docs?.length) {
    await db
      .collection(item.related.collection)
      .insertMany(
        item.related.docs as Parameters<
          ReturnType<typeof db.collection>["insertMany"]
        >[0],
        { ordered: false }
      )
      .catch(() => {
        /* partial restore of dependents is acceptable */
      });
  }
}
