import fs from "node:fs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loadGoogleDriveFile } from "@/lib/google";
import { getVaultItemByIdAsync } from "@/lib/repository";
import { readBinaryFile } from "@/lib/storage";

const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-nimbus-session" : "nimbus-session";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { itemId } = await params;
  const store = await cookies();
  const userId = store.get(SESSION_COOKIE)?.value;

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const item = await getVaultItemByIdAsync(userId, itemId);

  if (!item) {
    return new NextResponse("Not found", { status: 404 });
  }

  const meta = item.meta ?? {};

  if (typeof meta.storedObjectKey === "string") {
    const mimeType =
      typeof meta.originalType === "string" && meta.originalType
        ? meta.originalType
        : "application/octet-stream";
    try {
      const file = await readBinaryFile(meta.storedObjectKey);
      return new NextResponse(file.buffer, {
        headers: {
          "Content-Type": mimeType || file.contentType,
          "Content-Length": String(file.buffer.byteLength),
          "Cache-Control": "private, max-age=60",
        },
      });
    } catch {
      return new NextResponse("Stored file is missing.", { status: 404 });
    }
  }

  if (typeof meta.storedPath === "string" && fs.existsSync(meta.storedPath)) {
    const mimeType =
      typeof meta.originalType === "string" && meta.originalType
        ? meta.originalType
        : "application/octet-stream";
    const buffer = fs.readFileSync(meta.storedPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  if (typeof meta.fileId === "string" && item.sourceAccountId) {
    try {
      const result = await loadGoogleDriveFile(item.sourceAccountId, meta.fileId);

      if (result.kind === "link") {
        if (!result.webViewLink) {
          return new NextResponse("This Google-native file cannot be previewed yet.", { status: 415 });
        }

        return NextResponse.redirect(result.webViewLink);
      }

      return new NextResponse(result.buffer, {
        headers: {
          "Content-Type": result.mimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(result.fileName)}"`,
          "Cache-Control": "private, max-age=60",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open file.";
      return new NextResponse(message, { status: 500 });
    }
  }

  return new NextResponse("No preview available.", { status: 404 });
}
