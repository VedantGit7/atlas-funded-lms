export const ENTITLEMENT_BACKED_FEATURE_FLAG_KEYS = [
  "community.enable",
  "community.private_spaces.enable",
  "certification.enable",
  "gamification.enable",
  "branding.custom_domain.enable",
  "data.export.enable",
] as const;

export const OVERRIDABLE_FEATURE_FLAG_KEYS = ["analytics.dashboard.view"] as const;

const CATALOGUE_KEYS_SORTED = [
  ...ENTITLEMENT_BACKED_FEATURE_FLAG_KEYS,
  ...OVERRIDABLE_FEATURE_FLAG_KEYS,
].sort((a, b) => b.length - a.length);

export function resolveCanonicalFeatureFlagKey(key: string): string {
  for (const known of CATALOGUE_KEYS_SORTED) {
    if (key === known || key.startsWith(`${known}.`)) {
      return known;
    }
  }
  return key;
}

export function isEntitlementBackedFeatureFlagKey(key: string): boolean {
  const canonical = resolveCanonicalFeatureFlagKey(key);
  return (ENTITLEMENT_BACKED_FEATURE_FLAG_KEYS as readonly string[]).includes(canonical);
}
