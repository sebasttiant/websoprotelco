"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { z } from "zod";

import { query } from "@/server/db/pool";
import { verifyPassword } from "@/server/auth/password";
import { isRole, type Role } from "@/server/auth/rbac";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/server/auth/guards";
import { createSession, destroySession } from "@/server/auth/session";

export interface SignInState {
  error: string | null;
}

const GENERIC_SIGN_IN_ERROR = "Invalid email or password.";

// A well-formed but unusable scrypt hash. Verifying against it when the account is
// missing (or has no password set) keeps that failure path's timing comparable to a
// real wrong-password check, instead of returning early and leaking which case occurred.
const DUMMY_PASSWORD_HASH =
  "scrypt$16384$8$1$JOIOm4XitdoYeCIbns+GcA==$rYSwvqVdXVEaGH7vPE3b7r5/nlN7bWm72EDniJQGSAL0FrPzq9ekZNbz67INlyW8j9LZDiig7OexltIQIsV4Xg==";

const signInSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().min(1),
});

interface UserRow {
  id: string;
  password_hash: string | null;
  role: string;
  is_active: boolean;
}

function landingPathForRole(role: Role): string {
  return role === "customer" ? "/cuenta" : "/admin";
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: GENERIC_SIGN_IN_ERROR };
  }

  const { email, password } = parsed.data;

  const rows = await query<UserRow>("SELECT id, password_hash, role, is_active FROM users WHERE lower(email) = $1", [
    email,
  ]);
  const user = rows[0];

  const passwordMatches = await verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);

  if (!user || !user.password_hash || !user.is_active || !isRole(user.role) || !passwordMatches) {
    return { error: GENERIC_SIGN_IN_ERROR };
  }

  const { token, expiresAt } = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));

  redirect(landingPathForRole(user.role));
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await destroySession(token);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
