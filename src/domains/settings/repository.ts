// Next resolves this specifier through its own bundled copy, so it needs no entry in
// package.json. It fails the build if a client component ever reaches this module.
import "server-only";

import type { QueryResultRow } from "pg";

import { query } from "@/server/db/pool";

export interface SettingRow extends QueryResultRow {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  updated_at: string;
}

export async function findAllSettings(): Promise<SettingRow[]> {
  return query<SettingRow>("SELECT id, key, value, description, updated_at FROM settings ORDER BY key ASC");
}

export async function updateSettingByKey(key: string, value: string, updatedBy: string): Promise<void> {
  await query("UPDATE settings SET value = $2, updated_by = $3, updated_at = NOW() WHERE key = $1", [
    key,
    value,
    updatedBy,
  ]);
}
