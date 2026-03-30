import { NextRequest, NextResponse } from "next/server";
import { createGoogleConsentUrl } from "@/lib/google";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const label = request.nextUrl.searchParams.get("label");
  const emailHint = request.nextUrl.searchParams.get("emailHint") ?? undefined;

  if (!userId || !label) {
    return NextResponse.redirect(
      new URL("/admin/google?google=missing-params", request.url),
    );
  }

  try {
    const url = createGoogleConsentUrl({
      userId,
      label,
      googleEmailHint: emailHint,
    });

    return NextResponse.redirect(url);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create consent URL.";
    const url = new URL("/admin/google", request.url);
    url.searchParams.set("user", userId);
    url.searchParams.set("google", "setup-error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  }
}
