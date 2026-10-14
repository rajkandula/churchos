"use client";

import { api } from "@/lib/client-api";

/**
 * Browser → bucket direct upload: ask the API for a presigned URL, then PUT
 * the file straight to object storage so large files never touch the app
 * server.
 */
export async function uploadFile(file: File, folder: string): Promise<string> {
  const { uploadUrl, publicUrl } = await api<{
    uploadUrl: string;
    publicUrl: string;
  }>("/api/uploads/presign", {
    method: "POST",
    json: {
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      folder,
    },
  });

  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });
  } catch {
    // fetch itself rejecting usually means the bucket blocked the browser
    throw new Error(
      "Upload was blocked before reaching storage — check the storage bucket's CORS settings, then try again."
    );
  }
  if (!res.ok) throw new Error("Upload failed. Please try again.");
  return publicUrl;
}
