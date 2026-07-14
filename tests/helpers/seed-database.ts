import { Client } from "pg";

import { getTestDatabaseUrl } from "./database-url";

async function seedDatabase(): Promise<void> {
  const client = new Client({ connectionString: getTestDatabaseUrl() });
  await client.connect();

  try {
    await client.query("CREATE TABLE IF NOT EXISTS seed_metadata (key text PRIMARY KEY, value text NOT NULL)");
    await client.query(
      "INSERT INTO seed_metadata (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      ["foundation", "ready"],
    );
  } finally {
    await client.end();
  }
}

seedDatabase().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
