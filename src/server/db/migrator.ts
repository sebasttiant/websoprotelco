import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Pool } from "pg";

export interface Migration {
  id: string;
  name: string;
  filename: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigration {
  id: string;
  checksum: string;
}

const migrationFilenamePattern = /^(\d{4})_([a-z0-9_]+)\.sql$/;

// The value is arbitrary; it only has to stay stable across deploys so that
// concurrent migration runs serialize against the same advisory lock.
const MIGRATION_LOCK_KEY = 847_291_053;

export function parseMigrationFilename(filename: string): { id: string; name: string } | null {
  const match = migrationFilenamePattern.exec(filename);

  if (!match) {
    return null;
  }

  const [, id, name] = match;

  return { id, name };
}

export function checksumSql(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

export function loadMigrations(directory: string): Migration[] {
  const entries = readdirSync(directory);
  const migrations: Migration[] = [];

  for (const filename of entries) {
    if (!filename.endsWith(".sql")) {
      continue;
    }

    const parsed = parseMigrationFilename(filename);

    if (!parsed) {
      throw new Error(`Malformed migration filename: ${filename}`);
    }

    const sql = readFileSync(join(directory, filename), "utf8");

    migrations.push({
      id: parsed.id,
      name: parsed.name,
      filename,
      sql,
      checksum: checksumSql(sql),
    });
  }

  migrations.sort((a, b) => a.id.localeCompare(b.id));

  for (let i = 1; i < migrations.length; i += 1) {
    if (migrations[i].id === migrations[i - 1].id) {
      throw new Error(`Duplicate migration id: ${migrations[i].id}`);
    }
  }

  return migrations;
}

export function selectPendingMigrations(all: Migration[], applied: AppliedMigration[]): Migration[] {
  const byId = new Map(all.map((migration) => [migration.id, migration]));
  const appliedIds = applied.map((migration) => migration.id).sort((a, b) => a.localeCompare(b));
  const highestAppliedId = appliedIds.length > 0 ? appliedIds[appliedIds.length - 1] : null;

  for (const appliedMigration of applied) {
    const file = byId.get(appliedMigration.id);

    if (!file) {
      throw new Error(`Applied migration ${appliedMigration.id} has no matching file on disk.`);
    }

    if (file.checksum !== appliedMigration.checksum) {
      throw new Error(`Applied migration ${appliedMigration.id} was edited after it was applied.`);
    }
  }

  const appliedIdSet = new Set(applied.map((migration) => migration.id));
  const pending = all.filter((migration) => !appliedIdSet.has(migration.id));

  if (highestAppliedId) {
    for (const migration of pending) {
      if (migration.id.localeCompare(highestAppliedId) < 0) {
        throw new Error(`Migration ${migration.id} sorts before the highest applied migration ${highestAppliedId}.`);
      }
    }
  }

  return pending.sort((a, b) => a.id.localeCompare(b.id));
}

export async function runMigrations(pool: Pool, directory: string): Promise<{ applied: string[] }> {
  const client = await pool.connect();

  try {
    // The lock is taken before schema_migrations is created because
    // CREATE TABLE IF NOT EXISTS is not race-free: concurrent deploys can collide
    // on the system catalogs and one of them fails with a duplicate key error.
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);

    try {
      await client.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, name text NOT NULL, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
      );

      const all = loadMigrations(directory);
      const { rows } = await client.query<AppliedMigration>("SELECT id, checksum FROM schema_migrations");
      const pending = selectPendingMigrations(all, rows);
      const appliedIds: string[] = [];

      for (const migration of pending) {
        await client.query("BEGIN");

        try {
          await client.query(migration.sql);
          await client.query("INSERT INTO schema_migrations (id, name, checksum) VALUES ($1, $2, $3)", [
            migration.id,
            migration.name,
            migration.checksum,
          ]);
          await client.query("COMMIT");
          appliedIds.push(migration.id);
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }

      return { applied: appliedIds };
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}
