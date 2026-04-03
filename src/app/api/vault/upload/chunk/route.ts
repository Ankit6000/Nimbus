import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-nimbus-session" : "nimbus-session";

export async function POST(request: Request) {
  const store = await cookies();
  const userId = store.get(SESSION_COOKIE)?.value;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uploadUrl = request.headers.get("x-google-upload-url")?.trim() ?? "";
  const contentType = request.headers.get("x-upload-content-type")?.trim() || "application/octet-stream";
  const startByte = Number(request.headers.get("x-upload-start") ?? "");
  const endByte = Number(request.headers.get("x-upload-end") ?? "");
  const totalBytes = Number(request.headers.get("x-upload-total") ?? "");

  if (!uploadUrl || !Number.isFinite(startByte) || !Number.isFinite(endByte) || !Number.isFinite(totalBytes)) {
    return NextResponse.json({ error: "Missing upload chunk metadata." }, { status: 400 });
  }

  const body = Buffer.from(await request.arrayBuffer());
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Range": `bytes ${startByte}-${endByte - 1}/${totalBytes}`,
    },
    body,
  });

  if (response.status === 308 || (response.status >= 200 && response.status < 300)) {
    return NextResponse.json({
      ok: true,
      complete: response.status >= 200 && response.status < 300,
    });
  }

  const text = await response.text().catch(() => "");
  return NextResponse.json(
    {
      error: text || "Google upload chunk failed.",
    },
    { status: 500 },
  );
}
