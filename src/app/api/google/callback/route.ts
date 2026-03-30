import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/google";

function parseState(state: string) {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      userId?: string;
      label?: string;
    };
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const parsedState = state ? parseState(state) : {};

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/admin/google?google=missing-callback-data", request.url),
    );
  }

  try {
    const userId = await exchangeGoogleCode(code, state);
    const url = new URL("/admin/google", request.url);
    url.searchParams.set("user", userId);
    url.searchParams.set("google", "connected");
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth callback failed.";
    const url = new URL("/admin/google", request.url);
    if (parsedState.userId) {
      url.searchParams.set("user", parsedState.userId);
    }
    url.searchParams.set("google", "oauth-error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  }
}
