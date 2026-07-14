import { createHash, randomBytes } from "node:crypto";

import { query } from "@/server/db/pool";

import { isRole, type Role } from "./rbac";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
}

const TOKEN_BYTES = 32;

export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)", [
    userId,
    tokenHash,
    expiresAt,
  ]);

  return { token, expiresAt };
}

interface SessionUserRow {
  id: string;
  email: string;
  role: string;
}

export async function findSessionUser(token: string): Promise<SessionUser | null> {
  const tokenHash = hashSessionToken(token);

  // Expiry is filtered in SQL (not in JS) so an expired row can never reach the
  // application as if it were live.
  const rows = await query<SessionUserRow>(
    `SELECT u.id, u.email, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active = true`,
    [tokenHash],
  );

  const row = rows[0];

  if (!row || !isRole(row.role)) {
    return null;
  }

  await query("UPDATE sessions SET last_used_at = now() WHERE token_hash = $1", [tokenHash]);

  return { id: row.id, email: row.email, role: row.role };
}

export async function destroySession(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);

  await query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
}

interface DeletedSessionRow {
  id: string;
}

export async function deleteExpiredSessions(): Promise<number> {
  const rows = await query<DeletedSessionRow>("DELETE FROM sessions WHERE expires_at <= now() RETURNING id");

  return rows.length;
}
