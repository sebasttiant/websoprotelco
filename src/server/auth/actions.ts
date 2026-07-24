"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { z } from "zod";

import { query } from "@/server/db/pool";
import { hashPassword, verifyPassword } from "@/server/auth/password";
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

export interface SignUpState {
  error: string | null;
}

const MIN_PASSWORD_LENGTH = 8;

const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), "Ingresá un correo electrónico válido."),
  password: z.string().min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`),
});

// Public customer self-registration: always creates a `customer`, never a privileged role,
// so this route can never mint an admin. A taken email is reported plainly because signup
// needs it; sign-in stays deliberately generic.
export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const { email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  // ON CONFLICT against the lower(email) unique index keeps this a single atomic write with no
  // separate existence check to race, and reuses the same conflict target as create-admin.
  const rows = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, role, is_active)
     VALUES ($1, $2, 'customer', true)
     ON CONFLICT ((lower(email))) DO NOTHING
     RETURNING id`,
    [email, passwordHash],
  );
  const user = rows[0];

  if (!user) {
    return { error: "Ese correo ya está registrado. Iniciá sesión." };
  }

  const { token, expiresAt } = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));

  redirect("/cuenta");
}
