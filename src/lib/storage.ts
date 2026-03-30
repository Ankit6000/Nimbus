import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

const localRoot = path.join(process.cwd(), "data", "uploads");

function sanitizeName(value: string) {
  return (value || "file")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .trim();
}

function createObjectKey(scope: string[], fileName: string) {
  const cleanedScope = scope.map((segment) => sanitizeName(segment)).filter(Boolean);
  return [...cleanedScope, `${Date.now()}-${randomUUID()}-${sanitizeName(fileName)}`].join("/");
}

function hasRemoteStorageConfig() {
  return Boolean(
    process.env.OBJECT_STORAGE_BUCKET &&
      process.env.OBJECT_STORAGE_REGION &&
      process.env.OBJECT_STORAGE_ACCESS_KEY_ID &&
      process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  );
}

function getS3Client() {
  if (!hasRemoteStorageConfig()) {
    return null;
  }

  return new S3Client({
    region: process.env.OBJECT_STORAGE_REGION,
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT || undefined,
    forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY!,
    },
  });
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function storeBinaryFile(input: {
  scope: string[];
  fileName: string;
  contentType: string;
  buffer: Buffer;
}) {
  const objectKey = createObjectKey(input.scope, input.fileName);
  const client = getS3Client();

  if (client) {
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.OBJECT_STORAGE_BUCKET!,
        Key: objectKey,
        Body: input.buffer,
        ContentType: input.contentType || "application/octet-stream",
      }),
    );

    return {
      objectKey,
      provider: "s3" as const,
    };
  }

  const localPath = path.join(localRoot, objectKey);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, input.buffer);

  return {
    objectKey,
    provider: "local" as const,
  };
}

export async function readBinaryFile(objectKey: string) {
  const client = getS3Client();

  if (client) {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: process.env.OBJECT_STORAGE_BUCKET!,
        Key: objectKey,
      }),
    );

    if (!response.Body) {
      throw new Error("Stored object body is missing.");
    }

    const body =
      typeof response.Body.transformToByteArray === "function"
        ? Buffer.from(await response.Body.transformToByteArray())
        : await streamToBuffer(response.Body as NodeJS.ReadableStream);

    return {
      buffer: body,
      contentType: response.ContentType || "application/octet-stream",
    };
  }

  const localPath = path.join(localRoot, objectKey);
  if (!fs.existsSync(localPath)) {
    throw new Error("Stored object not found.");
  }

  return {
    buffer: fs.readFileSync(localPath),
    contentType: "application/octet-stream",
  };
}

export async function deleteBinaryFile(objectKey: string) {
  const client = getS3Client();

  if (client) {
    await client.send(
      new DeleteObjectCommand({
        Bucket: process.env.OBJECT_STORAGE_BUCKET!,
        Key: objectKey,
      }),
    );
    return;
  }

  const localPath = path.join(localRoot, objectKey);
  if (fs.existsSync(localPath)) {
    fs.unlinkSync(localPath);
  }
}

export function getStorageMode() {
  return hasRemoteStorageConfig() ? "remote" : "local";
}
