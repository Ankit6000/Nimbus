import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteGoogleDriveFile, syncAssignedGoogleAccountsForUser } from "@/lib/google";
import { deleteVaultItemAndRelated, getVaultItemByIdAsync } from "@/lib/repository";

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
        itemIds?: string[];
      }
    | null;

  const itemId = typeof payload?.itemId === "string" ? payload.itemId.trim() : "";
  const itemIds = Array.isArray(payload?.itemIds)
    ? payload.itemIds
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value): value is string => Boolean(value))
    : [];
  const requestedIds = itemId ? [itemId] : itemIds;

  if (!requestedIds.length) {
    return NextResponse.json({ error: "Missing item id." }, { status: 400 });
  }

  const deletedIds = new Set<string>();
  const failed: Array<{ itemId: string; error: string }> = [];
  const warnings: string[] = [];
  let shouldSyncGoogle = false;

  for (const requestedId of requestedIds) {
    const target = await getVaultItemByIdAsync(userId, requestedId);

    if (!target) {
      failed.push({ itemId: requestedId, error: "Item not found." });
      continue;
    }

    const fileId = typeof target.meta?.fileId === "string" ? target.meta.fileId : null;

    try {
      if (
        fileId &&
        target.sourceAccountId &&
        (target.source?.startsWith("google-drive") || target.source === "google-drive")
      ) {
        await deleteGoogleDriveFile(target.sourceAccountId, fileId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed.";
      warnings.push(message);
    }

    const result = deleteVaultItemAndRelated(userId, requestedId);
    if (!result) {
      failed.push({ itemId: requestedId, error: "Item no longer exists." });
      continue;
    }

    result.deletedIds.forEach((deletedId) => deletedIds.add(deletedId));
    if (
      result.target.section === "drive" ||
      result.target.section === "photos" ||
      result.target.section === "videos"
    ) {
      shouldSyncGoogle = true;
    }
  }

  if (shouldSyncGoogle) {
    await syncAssignedGoogleAccountsForUser(userId).catch(() => null);
  }

  if (!deletedIds.size && failed.length) {
    return NextResponse.json(
      {
        error: failed[0]?.error ?? "Delete failed.",
        failed,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: failed.length === 0,
    deletedIds: Array.from(deletedIds),
    failed,
    warning: warnings[0],
  });
}
