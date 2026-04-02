import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminByIdAsync, getPortalUserByIdAsync } from "@/lib/repository";

const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-nimbus-session" : "nimbus-session";
const LEGACY_SESSION_COOKIE = "nimbus-session";

function getSessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function createSession(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, userId, {
    ...getSessionCookieOptions(),
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  const store = await cookies();
  for (const cookieName of new Set([SESSION_COOKIE, LEGACY_SESSION_COOKIE])) {
    store.set(cookieName, "", {
      ...getSessionCookieOptions(),
      expires: new Date(0),
      maxAge: 0,
    });
  }
}

export async function getCurrentUser() {
  const store = await cookies();
  const userId = store.get(SESSION_COOKIE)?.value;

  if (!userId) return null;

  return getPortalUserByIdAsync(userId);
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  return user;
}

export async function requireAdmin() {
  const store = await cookies();
  const userId = store.get(SESSION_COOKIE)?.value;

  if (!userId) {
    redirect("/admin");
  }

  const admin = await getAdminByIdAsync(userId);

  if (!admin) {
    redirect("/admin");
  }

  return admin;
}

export async function getCurrentAdmin() {
  const store = await cookies();
  const userId = store.get(SESSION_COOKIE)?.value;

  if (!userId) {
    return null;
  }

  return getAdminByIdAsync(userId);
}
