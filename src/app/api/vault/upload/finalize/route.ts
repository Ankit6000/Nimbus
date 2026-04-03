import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { finalizeGoogleDriveUploads } from "@/lib/google";

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
        uploadedCount?: number;
        redirectTo?: string;
      }
    | null;

  const uploadedCount =
    typeof payload?.uploadedCount === "number" && Number.isFinite(payload.uploadedCount)
      ? Math.max(0, payload.uploadedCount)
      : 0;
  const redirectTo = typeof payload?.redirectTo === "string" ? payload.redirectTo : "/dashboard";

  try {
    const uploaded = await finalizeGoogleDriveUploads(userId, uploadedCount);
    return NextResponse.json({
      ok: true,
      redirectTo: `${redirectTo}?sync=${uploaded > 0 ? "google-uploaded" : "google-upload-invalid"}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload finalization failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
