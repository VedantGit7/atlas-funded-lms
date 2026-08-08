export const TENANT_CONFIG_SECTIONS = [
  { key: "proctoring", label: "Proctoring" },
  { key: "community", label: "Community" },
  { key: "notifications", label: "Notifications" },
  { key: "localization", label: "Localization" },
  { key: "integrations", label: "Integrations" },
  { key: "security", label: "Security" },
] as const;

export type TenantConfigSectionKey = (typeof TENANT_CONFIG_SECTIONS)[number]["key"];

export function pickConfigSection(
  configJson: Record<string, unknown>,
  sectionKey: TenantConfigSectionKey,
): Record<string, unknown> {
  const value = configJson[sectionKey];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function mergeConfigSection(
  configJson: Record<string, unknown>,
  sectionKey: TenantConfigSectionKey,
  sectionValue: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...configJson,
    [sectionKey]: sectionValue,
  };
}
