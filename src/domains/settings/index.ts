// Public surface of the settings domain. Consumers (admin settings page,
// components) must import from here rather than reaching into ./schemas,
// ./repository, ./service, or ./actions directly.

export type { SettingSummary, SettingUpdateInput, SiteSettings } from "./schemas";

export { DEFAULT_SITE_SETTINGS, getAllSettings, getSiteSettings } from "./service";

export { updateSetting, type SettingsActionState } from "./actions";
