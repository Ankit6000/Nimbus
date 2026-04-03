import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createGoogleDriveUploadSession } from "@/lib/google";

const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-nimbus-session" : "nimbus-session";

export async function POST(request: Request) {
  const store = await cookies();
  const userId = store.get(SESSION_COOKIE)?.value;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
        folderPath?: string;
      }
    | null;

  const fileName = typeof payload?.fileName === "string" ? payload.fileName.trim() : "";
  const fileSize =
    typeof payload?.fileSize === "number" && Number.isFinite(payload.fileSize) ? payload.fileSize : 0;
  const mimeType = typeof payload?.mimeType === "string" ? payload.mimeType : "";
  const folderPath = typeof payload?.folderPath === "string" ? payload.folderPath : "";

  if (!fileName || fileSize <= 0) {
    return NextResponse.json({ error: "Missing file metadata." }, { status: 400 });
  }

  try {
    const session = await createGoogleDriveUploadSession({
      userId,
      fileName,
      fileSize,
      mimeType,
      folderPath,
    });

    return NextResponse.json({ ok: true, ...session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create upload session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
