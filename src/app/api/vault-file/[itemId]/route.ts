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

function buildMediaResponse(
  request: Request,
  buffer: Buffer,
  mimeType: string,
  extraHeaders: Record<string, string> = {},
) {
  const body = new Uint8Array(buffer);
  const range = request.headers.get("range");

  if (!range) {
    return new NextResponse(body, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=60",
        ...extraHeaders,
      },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    return new NextResponse("Invalid range", { status: 416 });
  }

  const total = buffer.byteLength;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : total - 1;

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    start < 0 ||
    end >= total ||
    start > end
  ) {
    return new NextResponse("Range not satisfiable", {
      status: 416,
      headers: {
        "Content-Range": `bytes */${total}`,
      },
    });
  }

  const chunk = body.subarray(start, end + 1);

  return new NextResponse(chunk, {
    status: 206,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(chunk.byteLength),
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=60",
      ...extraHeaders,
    },
  });
}

export async function GET(request: Request, { params }: RouteContext) {
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
      return buildMediaResponse(request, file.buffer, mimeType || file.contentType);
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
    return buildMediaResponse(request, buffer, mimeType);
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

      return buildMediaResponse(request, result.buffer, result.mimeType, {
        "Content-Disposition": `inline; filename="${encodeURIComponent(result.fileName)}"`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open file.";
      return new NextResponse(message, { status: 500 });
    }
  }

  return new NextResponse("No preview available.", { status: 404 });
}
