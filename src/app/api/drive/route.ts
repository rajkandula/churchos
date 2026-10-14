import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { DriveItem } from "@/models/DriveItem";
import { getSession } from "@/lib/auth";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { logActivity, moveToRecycleBin } from "@/lib/audit";

function parseParent(raw: string | null): Types.ObjectId | null {
  return raw && Types.ObjectId.isValid(raw) ? new Types.ObjectId(raw) : null;
}

/** Items in a folder plus the breadcrumb trail back to the root. */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("drive");
    await connectDb();

    const parent = parseParent(req.nextUrl.searchParams.get("parent"));
    const items = await DriveItem.find({ churchId: user.churchId, parent }).lean();
    items.sort(
      (a, b) =>
        (a.type === "folder" ? 0 : 1) - (b.type === "folder" ? 0 : 1) ||
        a.name.localeCompare(b.name)
    );

    // Breadcrumbs: walk up the tree (bounded — folders don't nest that deep)
    const path: { _id: string; name: string }[] = [];
    let cursor = parent;
    for (let depth = 0; cursor && depth < 20; depth++) {
      const folder = await DriveItem.findOne({
        _id: cursor,
        churchId: user.churchId,
      }).lean();
      if (!folder) break;
      path.unshift({ _id: String(folder._id), name: folder.name });
      cursor = (folder.parent as Types.ObjectId | null) ?? null;
    }

    return NextResponse.json({
      items: items.map((i) => ({
        ...i,
        _id: String(i._id),
        parent: i.parent ? String(i.parent) : null,
      })),
      path,
    });
  });
}

/** Create a folder, or register an uploaded file. */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("drive");
    const session = await getSession();
    const body = await readBody(req);

    const type = body.type === "folder" ? "folder" : "file";
    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("Give it a name.");
    const parent = parseParent(String(body.parent ?? ""));

    if (parent) {
      const parentDoc = await (async () => {
        await connectDb();
        return DriveItem.findOne({ _id: parent, churchId: user.churchId }).lean();
      })();
      if (!parentDoc || parentDoc.type !== "folder")
        return jsonError("Folder not found.", 404);
    } else {
      await connectDb();
    }

    if (type === "file" && !String(body.url ?? "").trim())
      return jsonError("File upload incomplete — try again.");

    const item = await DriveItem.create({
      churchId: user.churchId,
      type,
      name,
      parent,
      url: type === "file" ? String(body.url).trim() : "",
      size: type === "file" ? Math.max(0, Number(body.size) || 0) : 0,
      contentType: type === "file" ? String(body.contentType ?? "") : "",
      createdBy: new Types.ObjectId(user.id),
      createdByName: session?.name ?? "",
    });

    await logActivity(
      user,
      "create",
      "driveItem",
      `${item.type === "folder" ? "Folder " : ""}${item.name}`,
      item._id
    );

    return NextResponse.json(
      { item: { ...item.toObject(), _id: String(item._id) } },
      { status: 201 }
    );
  });
}

export async function PATCH(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("drive");
    const body = await readBody(req);
    const id = String(body.id ?? "");
    const name = String(body.name ?? "").trim();
    if (!Types.ObjectId.isValid(id)) return jsonError("Item not found.", 404);
    if (!name) return jsonError("Name cannot be empty.");

    await connectDb();
    const item = await DriveItem.findOneAndUpdate(
      { _id: id, churchId: user.churchId },
      { name },
      { new: true }
    ).lean();
    if (!item) return jsonError("Item not found.", 404);
    await logActivity(
      user,
      "update",
      "driveItem",
      `${item.type === "folder" ? "Folder " : ""}${item.name}`,
      id
    );
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("drive");
    const id = req.nextUrl.searchParams.get("id") ?? "";
    if (!Types.ObjectId.isValid(id)) return jsonError("Item not found.", 404);

    await connectDb();
    const item = await DriveItem.findOne({
      _id: id,
      churchId: user.churchId,
    }).lean();
    if (!item) return jsonError("Item not found.", 404);

    if (item.type === "folder") {
      const children = await DriveItem.countDocuments({
        churchId: user.churchId,
        parent: item._id,
      });
      if (children > 0)
        return jsonError(
          `“${item.name}” isn't empty — move or delete its ${children} item${children === 1 ? "" : "s"} first.`,
          400
        );
    }

    await moveToRecycleBin({
      user,
      itemType: "driveItem",
      label: `${item.type === "folder" ? "Folder " : ""}${item.name}`,
      doc: item,
    });
    await DriveItem.deleteOne({ _id: item._id, churchId: user.churchId });
    return NextResponse.json({ ok: true });
  });
}
