// Next resolves this specifier through its own bundled copy, so it needs no entry in
// package.json. It fails the build if a client component ever reaches this module.
// It belongs here rather than in server/db/pool.ts, because the migration scripts import
// the pool directly under tsx, where no bundler rewrites the specifier.
import "server-only";

import type { QueryResultRow } from "pg";

import { query } from "@/server/db/pool";

export interface AdminUserRow extends QueryResultRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AccountRow extends QueryResultRow {
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

export interface ProfileRow extends QueryResultRow {
  email: string;
  full_name: string | null;
}

export async function findAllUsersForAdmin(): Promise<AdminUserRow[]> {
  return query<AdminUserRow>(
    "SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC, email ASC",
  );
}

export async function findAdminUserById(id: string): Promise<AdminUserRow | null> {
  const rows = await query<AdminUserRow>(
    "SELECT id, email, full_name, role, is_active, created_at FROM users WHERE id = $1 LIMIT 1",
    [id],
  );
  return rows[0] ?? null;
}

export async function countActiveAdmins(): Promise<number> {
  const rows = await query<{ count: string }>(
    "SELECT count(*)::text AS count FROM users WHERE role = 'admin' AND is_active = true",
  );
  return Number(rows[0]?.count ?? 0);
}

export async function emailTakenByOtherUser(email: string, excludeId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2 LIMIT 1",
    [email, excludeId],
  );
  return rows.length > 0;
}

export interface AdminUserUpdate {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  /** When set, replaces the stored hash; when omitted, the password is left untouched. */
  passwordHash?: string;
}

export async function updateAdminUser(input: AdminUserUpdate): Promise<boolean> {
  const rows = await query<{ id: string }>(
    input.passwordHash
      ? `UPDATE users
         SET full_name = $2, email = $3, role = $4, is_active = $5, password_hash = $6
         WHERE id = $1
         RETURNING id`
      : `UPDATE users
         SET full_name = $2, email = $3, role = $4, is_active = $5
         WHERE id = $1
         RETURNING id`,
    input.passwordHash
      ? [input.id, input.fullName, input.email, input.role, input.isActive, input.passwordHash]
      : [input.id, input.fullName, input.email, input.role, input.isActive],
  );
  return rows.length > 0;
}

export async function deleteAdminUser(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
  return rows.length > 0;
}

export async function findAccountById(id: string): Promise<AccountRow | null> {
  const rows = await query<AccountRow>(
    "SELECT email, full_name, role, created_at FROM users WHERE id = $1 LIMIT 1",
    [id],
  );

  return rows[0] ?? null;
}

export async function findProfileById(id: string): Promise<ProfileRow | null> {
  const rows = await query<ProfileRow>("SELECT email, full_name FROM users WHERE id = $1 LIMIT 1", [id]);

  return rows[0] ?? null;
}

// The ONLY read in this domain that touches the credential column. It returns just
// the hash string for the password-change flow to re-verify against; its result is
// never mapped into a read model and never reaches a page or client component.
interface CredentialRow extends QueryResultRow {
  password_hash: string | null;
}

export async function findPasswordHashById(id: string): Promise<string | null> {
  const rows = await query<CredentialRow>("SELECT password_hash FROM users WHERE id = $1 LIMIT 1", [id]);

  return rows[0]?.password_hash ?? null;
}

// Updates the editable profile fields for exactly one user. Deliberately does NOT
// touch the email column: email is immutable through self-service so a user cannot
// repoint their account (and its quote history) at another address.
export async function updateProfileById(id: string, fullName: string): Promise<void> {
  await query("UPDATE users SET full_name = $2 WHERE id = $1", [id, fullName]);
}

export async function updatePasswordHashById(id: string, passwordHash: string): Promise<void> {
  await query("UPDATE users SET password_hash = $2 WHERE id = $1", [id, passwordHash]);
}

export interface NewAdminUser {
  fullName: string;
  email: string;
  passwordHash: string;
  role: string;
}

// Inserts a user for the admin directory, returning the new id or null when the email is
// already taken. ON CONFLICT against the lower(email) unique index makes this a single atomic
// write with no separate existence check to race — the same pattern signUp and create-admin
// use. A null return is a taken email, never a thrown 23505 that would surface as a 500.
export async function insertAdminUser(input: NewAdminUser): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `INSERT INTO users (email, full_name, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT ((lower(email))) DO NOTHING
     RETURNING id`,
    [input.email, input.fullName, input.passwordHash, input.role],
  );

  return rows[0]?.id ?? null;
}
