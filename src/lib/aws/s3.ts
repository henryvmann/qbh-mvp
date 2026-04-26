import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET || "quarterback-health-data";

/**
 * Store a health document in S3 under a pseudonymized key.
 * Key format: {pseudoId}/{docType}/{uuid}.{ext}
 * pseudoId is a hash of the app_user_id — never the real user ID.
 */
export async function storeHealthDocument(
  appUserId: string,
  file: Buffer,
  fileName: string,
  contentType: string,
  docType: "upload" | "recording" = "upload",
): Promise<string> {
  const pseudoId = await getPseudoId(appUserId);
  const ext = fileName.split(".").pop() || "bin";
  const key = `${pseudoId}/${docType}/${randomUUID()}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file,
      ContentType: contentType,
      ServerSideEncryption: "aws:kms",
      Metadata: {
        "original-filename": fileName,
        "doc-type": docType,
      },
    }),
  );

  return key;
}

/**
 * Retrieve a health document from S3.
 */
export async function getHealthDocument(key: string): Promise<{
  body: ReadableStream | null;
  contentType: string;
  metadata: Record<string, string>;
}> {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  );

  return {
    body: response.Body?.transformToWebStream() ?? null,
    contentType: response.ContentType || "application/octet-stream",
    metadata: response.Metadata || {},
  };
}

/**
 * Create a pseudonymous identifier from the app_user_id.
 * Uses a simple hash so the real user ID never appears in S3 keys.
 */
async function getPseudoId(appUserId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(appUserId + (process.env.AWS_SECRET_ACCESS_KEY || "salt"));
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes.slice(0, 12))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
