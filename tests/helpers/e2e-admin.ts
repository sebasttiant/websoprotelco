import { Client } from "pg";

import { hashPassword } from "../../src/server/auth/password";
import { assertTestDatabaseUrl } from "./database-url";

export interface E2eAdminCredentials {
  databaseUrl: string;
  email: string;
  password: string;
}

export interface E2eAdminEnvironment {
  DATABASE_URL?: string;
  E2E_ADMIN_EMAIL?: string;
  E2E_ADMIN_PASSWORD?: string;
}

export function getE2eAdminCredentials(env: E2eAdminEnvironment = process.env as unknown as E2eAdminEnvironment): E2eAdminCredentials {
  const databaseUrl = assertTestDatabaseUrl(env.DATABASE_URL ?? "");
  const email = env.E2E_ADMIN_EMAIL?.trim();
  const password = env.E2E_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required for E2E seeding.");
  }

  return { databaseUrl, email: email.toLowerCase(), password };
}

export async function seedE2eAdmin(credentials: E2eAdminCredentials): Promise<void> {
  const client = new Client({ connectionString: credentials.databaseUrl });
  await client.connect();

  try {
    const passwordHash = await hashPassword(credentials.password);
    await client.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, $2, 'admin', true)
       ON CONFLICT ((lower(email)))
       DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', is_active = true`,
      [credentials.email, passwordHash],
    );
  } finally {
    await client.end();
  }
}
