import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Media storage: any S3-compatible bucket (photos, documents, drive files).
 * Configure with the STORAGE_* variables in `.env.example`.
 */
export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.STORAGE_BUCKET &&
      process.env.STORAGE_ACCESS_KEY_ID &&
      process.env.STORAGE_SECRET_ACCESS_KEY &&
      process.env.STORAGE_ENDPOINT &&
      process.env.STORAGE_PUBLIC_URL
  );
}

function getClient(): S3Client {
  return new S3Client({
    region: process.env.STORAGE_REGION || "auto",
    endpoint: process.env.STORAGE_ENDPOINT,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Create a presigned PUT URL so the browser uploads straight to the bucket —
 * large files never pass through the Next.js server.
 */
export async function presignUpload(
  key: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: process.env.STORAGE_BUCKET!,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });
  const base = process.env.STORAGE_PUBLIC_URL?.replace(/\/$/, "") ?? "";
  return { uploadUrl, publicUrl: base ? `${base}/${key}` : key };
}
