import { Client } from "pg";

import { getTestDatabaseUrl } from "./database-url";

const protectedDatabaseNames = new Set(["postgres", "template0", "template1"]);

function getDatabaseName(connectionString: string): string {
  return new URL(connectionString).pathname.replace(/^\//, "");
}

function assertResettableDatabase(databaseName: string): void {
  if (protectedDatabaseNames.has(databaseName) || !databaseName.endsWith("_test")) {
    throw new Error(`Refusing to reset non-test database: ${databaseName}`);
  }
}

async function resetDatabase(): Promise<void> {
  const connectionString = getTestDatabaseUrl();
  const databaseName = getDatabaseName(connectionString);

  assertResettableDatabase(databaseName);

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO public");
  } finally {
    await client.end();
  }
}

resetDatabase().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
