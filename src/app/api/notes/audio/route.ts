import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { saveVaultAudioNoteToGoogleDrive } from "@/lib/google";

const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-nimbus-session" : "nimbus-session";

export async function POST(request: Request) {
  const store = await cookies();
  const userId = store.get(SESSION_COOKIE)?.value;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim() || "Voice Note";
  const file = formData.get("file");
  const durationMs = Number(formData.get("durationMs") ?? 0);

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No recording was uploaded." }, { status: 400 });
  }

  if (!file.type.startsWith("audio/")) {
    return NextResponse.json({ error: "The uploaded recording is not audio." }, { status: 415 });
  }

  try {
    const itemId = await saveVaultAudioNoteToGoogleDrive({
      userId,
      title,
      file,
      durationMs,
    });
    return NextResponse.json({ ok: true, itemId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice note upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
