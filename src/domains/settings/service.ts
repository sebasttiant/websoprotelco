import * as repository from "./repository";
import type { SettingRow } from "./repository";
import type { SettingSummary, SettingUpdateInput } from "./schemas";

function mapSettingSummary(row: SettingRow): SettingSummary {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    description: row.description,
    updatedAt: row.updated_at,
  };
}

export async function getAllSettings(): Promise<SettingSummary[]> {
  const rows = await repository.findAllSettings();
  return rows.map(mapSettingSummary);
}

export async function updateSetting(input: SettingUpdateInput, updatedBy: string): Promise<void> {
  await repository.updateSettingByKey(input.key, input.value, updatedBy);
}
