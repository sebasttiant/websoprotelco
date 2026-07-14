import { Client } from "pg";

import { getTestDatabaseUrl } from "./database-url";

async function resetDatabase(): Promise<void> {
  const connectionString = getTestDatabaseUrl();

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
