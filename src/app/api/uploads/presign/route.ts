import { NextRequest, NextResponse } from "next/server";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isStorageConfigured, presignUpload } from "@/lib/storage";

const MAX_SIZE_MB = 25;

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch();

    if (!isStorageConfigured()) {
      return jsonError(
        "Media storage is not configured yet. Add the STORAGE_* bucket settings to the environment.",
        503
      );
    }

    const body = await readBody(req);
    const fileName = String(body.fileName ?? "file").trim();
    const contentType = String(body.contentType ?? "application/octet-stream");
    const size = Number(body.size ?? 0);
    const folder = String(body.folder ?? "uploads").replace(/[^a-z0-9-]/gi, "");

    if (size > MAX_SIZE_MB * 1024 * 1024)
      return jsonError(`File is too large — the limit is ${MAX_SIZE_MB} MB.`);

    const safeName = fileName
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-80);
    // Every church's files live under its own prefix in the bucket
    const key = `${user.churchId}/${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}-${safeName}`;

    const { uploadUrl, publicUrl } = await presignUpload(key, contentType);
    return NextResponse.json({ uploadUrl, publicUrl, key });
  });
}
