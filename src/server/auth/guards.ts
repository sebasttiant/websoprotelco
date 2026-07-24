// There is no `import "server-only"` here because that package is not an installed
// dependency. Importing `next/headers` below carries the same guarantee: Next.js refuses
// to bundle a `next/headers` import into a client component at build time.
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { hasPermission, type Permission } from "./rbac";
import { findSessionUser, type SessionUser } from "./session";

export const SESSION_COOKIE_NAME = "session";

interface SessionCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  expires: Date;
}

// The session cookie is Secure in production so the token never travels over plain HTTP;
// a deployment terminating TLS in front (Cloudflare, a reverse proxy) keeps this working.
// SESSION_COOKIE_SECURE=false is an explicit escape hatch for reaching the site directly over
// HTTP with no TLS yet (e.g. http://<ip>:8686). Never leave it off for a real public site.
function resolveSecureSessionCookie(): boolean {
  if (process.env.SESSION_COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV !== "development";
}

export function sessionCookieOptions(expiresAt: Date): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: resolveSecureSessionCookie(),
    expires: expiresAt,
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return findSessionUser(token);
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireSession();

  // 404 instead of a redirect: a signed-in staff user should not learn that an admin
  // area exists at all.
  if (!hasPermission(user.role, permission)) {
    notFound();
  }

  return user;
}
