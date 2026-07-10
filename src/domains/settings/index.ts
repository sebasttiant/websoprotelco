// Public surface of the settings domain. Consumers (admin settings page,
// components) must import from here rather than reaching into ./schemas,
// ./repository, ./service, or ./actions directly.

export type { SettingSummary, SettingUpdateInput } from "./schemas";

export { getAllSettings } from "./service";

export { updateSetting, type SettingsActionState } from "./actions";
