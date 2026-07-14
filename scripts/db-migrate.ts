import { join } from "node:path";

// Relative, not the "@/" alias: these scripts run under tsx outside Next, where path
// mapping depends on tsconfig.json being present next to the current working directory.
import { getPool, closePool } from "../src/server/db/pool";
import { runMigrations } from "../src/server/db/migrator";

async function migrate(): Promise<void> {
  const directory = join(process.cwd(), "db", "migrations");

  try {
    const { applied } = await runMigrations(getPool(), directory);

    if (applied.length === 0) {
      console.log("No pending migrations.");
    } else {
      console.log(`Applied ${applied.length} migration(s): ${applied.join(", ")}`);
    }
  } finally {
    await closePool();
  }
}

migrate().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
