import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { uploadFilesToConnectedGoogleDrive } from "@/lib/google";
import { createSyncRunAsync } from "@/lib/repository";

const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-nimbus-session" : "nimbus-session";

export async function POST(request: Request) {
  const store = await cookies();
  const userId = store.get(SESSION_COOKIE)?.value;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");
  const folderPath = String(formData.get("folderPath") ?? "").trim();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (!files.length) {
    return NextResponse.json({ error: "Choose at least one file." }, { status: 400 });
  }

  try {
    const uploaded = await uploadFilesToConnectedGoogleDrive(userId, files, folderPath);
    await createSyncRunAsync(
      userId,
      "google-upload",
      uploaded > 0 ? "success" : "skipped",
      `Uploaded ${uploaded} file(s) directly into the connected Google Drive pool.`,
    );

    return NextResponse.json({
      ok: true,
      redirectTo: `${redirectTo}?sync=${uploaded > 0 ? "google-uploaded" : "google-upload-invalid"}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Drive upload failed.";
    await createSyncRunAsync(userId, "google-upload", "error", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
