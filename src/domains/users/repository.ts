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
    "SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at DESC, email ASC",
  );
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

export async function updateProfileById(id: string, fullName: string, email: string): Promise<void> {
  await query("UPDATE users SET full_name = $2, email = $3 WHERE id = $1", [id, fullName, email]);
}

export async function updatePasswordHashById(id: string, passwordHash: string): Promise<void> {
  await query("UPDATE users SET password_hash = $2 WHERE id = $1", [id, passwordHash]);
}
