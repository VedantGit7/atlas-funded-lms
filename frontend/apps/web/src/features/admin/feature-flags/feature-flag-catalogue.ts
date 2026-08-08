export type FeatureFlagCatalogueEntry = {
  label: string;
  description: string;
};

export const FEATURE_FLAG_CATALOGUE: Record<string, FeatureFlagCatalogueEntry> = {
  "community.enable": {
    label: "Community",
    description: "Enable community spaces for learners and instructors.",
  },
  "community.private_spaces.enable": {
    label: "Private community spaces",
    description: "Allow restricted community spaces visible only to invited members.",
  },
  "certification.enable": {
    label: "Certification",
    description: "Certification issue workflow and certificate delivery.",
  },
  "gamification.enable": {
    label: "Gamification",
    description: "Leaderboards, badges, and point systems.",
  },
  "analytics.dashboard.view": {
    label: "Analytics dashboard",
    description: "Premium analytics dashboard access for tenant administrators.",
  },
  "data.export.enable": {
    label: "Data export",
    description: "Batch export CSV and Excel functionality.",
  },
  "branding.custom_domain.enable": {
    label: "Custom domain",
    description: "White-label domain mapping for tenant branding.",
  },
};

export function getFeatureFlagPresentation(flag: {
  key: string;
  canonicalKey: string;
  description: string | null;
}): {
  displayKey: string;
  title: string;
  description: string;
  hasInstanceKey: boolean;
  instanceSuffix: string | null;
} {
  const catalogue = FEATURE_FLAG_CATALOGUE[flag.canonicalKey];
  const hasInstanceKey = flag.key !== flag.canonicalKey;
  const instanceSuffix = hasInstanceKey ? flag.key.slice(flag.canonicalKey.length + 1) : null;

  return {
    displayKey: flag.canonicalKey,
    title: catalogue?.label ?? formatKeyAsTitle(flag.canonicalKey),
    description:
      catalogue?.description ??
      flag.description ??
      "No description is registered for this feature flag.",
    hasInstanceKey,
    instanceSuffix,
  };
}

function formatKeyAsTitle(key: string): string {
  const segment = key.split(".").at(-1) ?? key;
  return segment
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isBooleanFeatureFlagValue(value: unknown): boolean {
  return typeof value === "boolean";
}

export function formatEffectiveFeatureFlagValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "Enabled" : "Disabled";
  }

  if (value && typeof value === "object" && "enabled" in value) {
    const enabled = Boolean((value as { enabled: unknown }).enabled);
    return enabled ? "Enabled" : "Disabled";
  }

  if (typeof value === "string") {
    return value.length > 0 ? `'${value}'` : "''";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return JSON.stringify(value);
}

export function serializeFeatureFlagOverrideValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

export function parseFeatureFlagOverrideValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw.startsWith("{") || raw.startsWith("[")) {
    return JSON.parse(raw) as unknown;
  }
  const asNumber = Number(raw);
  if (raw.trim() !== "" && !Number.isNaN(asNumber) && String(asNumber) === raw.trim()) {
    return asNumber;
  }
  return raw;
}

export function matchesFeatureFlagFilter(
  flag: { key: string; canonicalKey: string; description: string | null },
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const presentation = getFeatureFlagPresentation(flag);
  const haystack = [
    flag.key,
    flag.canonicalKey,
    presentation.title,
    presentation.description,
    flag.description ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}
