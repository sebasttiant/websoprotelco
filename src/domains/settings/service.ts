import * as repository from "./repository";
import type { SettingRow } from "./repository";
import type { SettingSummary, SettingUpdateInput, SiteSettings } from "./schemas";

// Mirrors db/migrations/0006_settings.sql so a missing or blank row still renders a
// coherent site instead of an empty header.
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: "SOPROTELCO",
  siteDescription:
    "Soluciones integrales en telecomunicaciones, fibra óptica, redes y conectividad para proyectos empresariales en Colombia.",
  contactEmail: "ventas@soprotelco.com",
  contactPhone: "+57 300 123 4567",
  address: "Bogotá, Colombia",
  businessHours: "Lun-Vie: 8:00-18:00, Sáb: 9:00-13:00",
  facebookUrl: null,
  instagramUrl: null,
  linkedinUrl: null,
  whatsappNumber: "+573001234567",
};

// Storage keys stay confined to this module. Consumers read SiteSettings, never the keys.
const SITE_SETTING_KEYS = {
  siteName: "site_name",
  siteDescription: "site_description",
  contactEmail: "contact_email",
  contactPhone: "contact_phone",
  address: "address",
  businessHours: "business_hours",
  facebookUrl: "facebook_url",
  instagramUrl: "instagram_url",
  linkedinUrl: "linkedin_url",
  whatsappNumber: "whatsapp_number",
} as const satisfies Record<keyof SiteSettings, string>;

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

// Blank and missing collapse to the same outcome: keep the default. Optional fields default
// to null, so a blank social URL needs no special case here.
export async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await repository.findAllSettings();
  const stored = new Map(rows.map((row) => [row.key, row.value?.trim() ?? ""]));
  const settings = { ...DEFAULT_SITE_SETTINGS };

  for (const field of Object.keys(SITE_SETTING_KEYS) as (keyof SiteSettings)[]) {
    const value = stored.get(SITE_SETTING_KEYS[field]);
    if (value) settings[field] = value;
  }

  return settings;
}

export async function updateSetting(input: SettingUpdateInput, updatedBy: string): Promise<void> {
  await repository.updateSettingByKey(input.key, input.value, updatedBy);
}
