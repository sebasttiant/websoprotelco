// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  checksumSql,
  loadMigrations,
  parseMigrationFilename,
  selectPendingMigrations,
  type AppliedMigration,
} from "../../../src/server/db/migrator";

let tempDirectories: string[] = [];

function createTempMigrationsDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "websoprotelco-migrations-"));
  tempDirectories.push(directory);
  return directory;
}

function writeMigrationFile(directory: string, filename: string, sql: string): void {
  writeFileSync(join(directory, filename), sql, "utf8");
}

afterEach(() => {
  for (const directory of tempDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
  tempDirectories = [];
});

describe("parseMigrationFilename", () => {
  test("accepts a well-formed migration filename", () => {
    expect(parseMigrationFilename("0001_initial_schema.sql")).toEqual({ id: "0001", name: "initial_schema" });
  });

  test("rejects a filename with fewer than four digits", () => {
    expect(parseMigrationFilename("1_x.sql")).toBeNull();
  });

  test("rejects a filename using a hyphen separator", () => {
    expect(parseMigrationFilename("0001-x.sql")).toBeNull();
  });

  test("rejects a filename with uppercase characters", () => {
    expect(parseMigrationFilename("0001_Initial.sql")).toBeNull();
  });

  test("rejects a non-migration filename", () => {
    expect(parseMigrationFilename("notes.md")).toBeNull();
  });
});

describe("checksumSql", () => {
  test("is stable for identical content", () => {
    expect(checksumSql("SELECT 1;")).toBe(checksumSql("SELECT 1;"));
  });

  test("differs for different content", () => {
    expect(checksumSql("SELECT 1;")).not.toBe(checksumSql("SELECT 2;"));
  });
});

describe("loadMigrations", () => {
  test("returns migrations in ascending id order", () => {
    const directory = createTempMigrationsDir();
    writeMigrationFile(directory, "0002_second.sql", "SELECT 2;");
    writeMigrationFile(directory, "0001_first.sql", "SELECT 1;");

    const migrations = loadMigrations(directory);

    expect(migrations.map((migration) => migration.id)).toEqual(["0001", "0002"]);
  });

  test("ignores non-.sql files", () => {
    const directory = createTempMigrationsDir();
    writeMigrationFile(directory, "0001_first.sql", "SELECT 1;");
    writeMigrationFile(directory, "README.md", "not a migration");

    const migrations = loadMigrations(directory);

    expect(migrations).toHaveLength(1);
  });

  test("throws on a malformed .sql filename", () => {
    const directory = createTempMigrationsDir();
    writeMigrationFile(directory, "bad-name.sql", "SELECT 1;");

    expect(() => loadMigrations(directory)).toThrow();
  });

  test("throws on duplicate ids", () => {
    const directory = createTempMigrationsDir();
    writeMigrationFile(directory, "0001_first.sql", "SELECT 1;");
    writeMigrationFile(directory, "0001_duplicate.sql", "SELECT 2;");

    expect(() => loadMigrations(directory)).toThrow();
  });
});

describe("selectPendingMigrations", () => {
  test("returns only unapplied migrations in ascending order", () => {
    const directory = createTempMigrationsDir();
    writeMigrationFile(directory, "0001_first.sql", "SELECT 1;");
    writeMigrationFile(directory, "0002_second.sql", "SELECT 2;");
    writeMigrationFile(directory, "0003_third.sql", "SELECT 3;");

    const all = loadMigrations(directory);
    const applied: AppliedMigration[] = [{ id: "0001", checksum: all[0].checksum }];

    const pending = selectPendingMigrations(all, applied);

    expect(pending.map((migration) => migration.id)).toEqual(["0002", "0003"]);
  });

  test("returns an empty array when everything is applied", () => {
    const directory = createTempMigrationsDir();
    writeMigrationFile(directory, "0001_first.sql", "SELECT 1;");

    const all = loadMigrations(directory);
    const applied: AppliedMigration[] = [{ id: "0001", checksum: all[0].checksum }];

    expect(selectPendingMigrations(all, applied)).toEqual([]);
  });

  test("throws when an applied migration's file was deleted", () => {
    const directory = createTempMigrationsDir();
    writeMigrationFile(directory, "0001_first.sql", "SELECT 1;");

    const all = loadMigrations(directory);
    const applied: AppliedMigration[] = [{ id: "0002", checksum: "does-not-matter" }];

    expect(() => selectPendingMigrations(all, applied)).toThrow();
  });

  test("throws when an applied migration's checksum changed", () => {
    const directory = createTempMigrationsDir();
    writeMigrationFile(directory, "0001_first.sql", "SELECT 1;");

    const all = loadMigrations(directory);
    const applied: AppliedMigration[] = [{ id: "0001", checksum: "stale-checksum" }];

    expect(() => selectPendingMigrations(all, applied)).toThrow();
  });

  test("throws when a new migration sorts before the highest applied id", () => {
    const directory = createTempMigrationsDir();
    writeMigrationFile(directory, "0001_first.sql", "SELECT 1;");
    writeMigrationFile(directory, "0002_second.sql", "SELECT 2;");

    const all = loadMigrations(directory);
    const applied: AppliedMigration[] = [{ id: "0002", checksum: all[1].checksum }];

    expect(() => selectPendingMigrations(all, applied)).toThrow();
  });
});
