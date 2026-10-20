import path from "node:path";

import { Client, Pool } from "pg";

import { hashPassword } from "../../src/server/auth/password";
import { runMigrations } from "../../src/server/db/migrator";
import { readAuthenticatedE2eEnvironment, type E2eAccount } from "./environment";

const CATEGORY_ID = "a1111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "a3333333-3333-4333-8333-333333333333";

async function insertUser(client: Client, account: E2eAccount, role: "admin" | "customer"): Promise<void> {
  await client.query("INSERT INTO users (email, password_hash, role, is_active) VALUES ($1, $2, $3, true)", [
    account.email,
    await hashPassword(account.password),
    role,
  ]);
}

// Runs once per authenticated run, after the web server is up and before any test. The reset is
// destructive, which is why `readAuthenticatedE2eEnvironment` has already refused every database
// that is not the throwaway `websoprotelco_e2e_test` on a loopback, non-default port.
export default async function globalSetup(): Promise<void> {
  const environment = readAuthenticatedE2eEnvironment();

  const resetClient = new Client({ connectionString: environment.databaseUrl });
  await resetClient.connect();

  try {
    await resetClient.query("DROP SCHEMA IF EXISTS public CASCADE");
    await resetClient.query("CREATE SCHEMA public");
  } finally {
    await resetClient.end();
  }

  const pool = new Pool({ connectionString: environment.databaseUrl, max: 2 });

  try {
    await runMigrations(pool, path.join(process.cwd(), "db", "migrations"));
  } finally {
    await pool.end();
  }

  const client = new Client({ connectionString: environment.databaseUrl });
  await client.connect();

  try {
    await insertUser(client, environment.admin, "admin");
    await insertUser(client, environment.customer, "customer");
    await client.query("INSERT INTO categories (id, slug, name, display_order) VALUES ($1, 'e2e-fibra', 'Fibra E2E', 1)", [
      CATEGORY_ID,
    ]);
    await client.query(
      `INSERT INTO products (id, category_id, sku, slug, name, description, price_cents, currency, image_url, brand, stock_quantity)
       VALUES ($1, $2, 'E2E-001', 'e2e-fusionadora', 'Fusionadora E2E', 'Producto de prueba aislada.', 1500000, 'COP', NULL, 'SOPROTELCO', 7)`,
      [PRODUCT_ID, CATEGORY_ID],
    );
  } finally {
    await client.end();
  }
}
