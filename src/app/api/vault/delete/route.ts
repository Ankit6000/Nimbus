import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteGoogleDriveFile, syncAssignedGoogleAccountsForUser } from "@/lib/google";
import { deleteVaultItemAndRelated, getVaultItemById } from "@/lib/repository";

const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-nimbus-session" : "nimbus-session";

export async function POST(request: Request) {
  const store = await cookies();
  const userId = store.get(SESSION_COOKIE)?.value;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        itemId?: string;
      }
    | null;

  const itemId = typeof payload?.itemId === "string" ? payload.itemId.trim() : "";

  if (!itemId) {
    return NextResponse.json({ error: "Missing item id." }, { status: 400 });
  }

  const target = getVaultItemById(userId, itemId);

  if (!target) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  try {
    const fileId = typeof target.meta?.fileId === "string" ? target.meta.fileId : null;
    if (
      fileId &&
      target.sourceAccountId &&
      (target.source?.startsWith("google-drive") || target.source === "google-drive")
    ) {
      await deleteGoogleDriveFile(target.sourceAccountId, fileId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  deleteVaultItemAndRelated(userId, itemId);

  if (target.section === "drive" || target.section === "photos" || target.section === "videos") {
    await syncAssignedGoogleAccountsForUser(userId).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
