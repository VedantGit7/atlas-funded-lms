import type { EntitlementView } from "@atlas/domain-config/schemas/entitlements";

export type EntitlementCatalogueEntry = {
  label: string;
  description: string;
};

export const KNOWN_ENTITLEMENT_KEYS = [
  "community.enable",
  "community.private_spaces.enable",
  "certification.enable",
  "gamification.enable",
  "analytics.dashboard.view",
  "data.export.enable",
  "branding.custom_domain.enable",
] as const;

export type KnownEntitlementKey = (typeof KNOWN_ENTITLEMENT_KEYS)[number];

export const ENTITLEMENT_CATALOGUE: Record<KnownEntitlementKey, EntitlementCatalogueEntry> = {
  "community.enable": {
    label: "Community",
    description: "Enable community spaces",
  },
  "community.private_spaces.enable": {
    label: "Private community spaces",
    description: "Private community spaces",
  },
  "certification.enable": {
    label: "Certification",
    description: "Issue certificates",
  },
  "gamification.enable": {
    label: "Gamification",
    description: "Badges and leaderboards",
  },
  "analytics.dashboard.view": {
    label: "Analytics dashboard",
    description: "Advanced analytics dashboard",
  },
  "data.export.enable": {
    label: "Data export",
    description: "Bulk data export",
  },
  "branding.custom_domain.enable": {
    label: "Custom domain",
    description: "Custom domain routing",
  },
};

export const ENTITLEMENT_UPGRADE_HINTS: Record<KnownEntitlementKey, string> = {
  "analytics.dashboard.view":
    "Contact your platform operator to enable advanced analytics on your plan.",
  "certification.enable":
    "Certificate features require the certification entitlement on your tenant plan.",
  "gamification.enable":
    "Badges and leaderboards require the gamification entitlement on your tenant plan.",
  "community.enable": "Community spaces require the community entitlement on your tenant plan.",
  "branding.custom_domain.enable":
    "Custom domains require a plan upgrade from your platform operator.",
  "data.export.enable": "Bulk export capabilities are controlled by your tenant plan.",
  "community.private_spaces.enable":
    "Private community spaces require a plan upgrade from your platform operator.",
};

export const ENTITLEMENT_GROUPS: Array<{
  id: string;
  label: string;
  keys: KnownEntitlementKey[];
}> = [
  {
    id: "community",
    label: "Community",
    keys: ["community.enable", "community.private_spaces.enable"],
  },
  {
    id: "learning",
    label: "Learning & Certification",
    keys: ["certification.enable", "gamification.enable"],
  },
  {
    id: "analytics",
    label: "Analytics & Data",
    keys: ["analytics.dashboard.view", "data.export.enable"],
  },
  {
    id: "branding",
    label: "Branding",
    keys: ["branding.custom_domain.enable"],
  },
];

const CATALOGUE_KEYS_SORTED = [...KNOWN_ENTITLEMENT_KEYS].sort((a, b) => b.length - a.length);

export function resolveCanonicalEntitlementKey(key: string): string {
  for (const known of CATALOGUE_KEYS_SORTED) {
    if (key === known || key.startsWith(`${known}.`)) {
      return known;
    }
  }
  return key;
}

export function isKnownEntitlementKey(key: string): key is KnownEntitlementKey {
  return (KNOWN_ENTITLEMENT_KEYS as readonly string[]).includes(key);
}

export type ResolvedEntitlement = {
  key: string;
  canonicalKey: string;
  value: unknown;
  enabled: boolean;
  expiresAt: string | null;
  label: string;
  description: string;
  guidance: string;
  hasInstanceKey: boolean;
};

export function mergeEntitlementsWithCatalogue(
  entitlements: EntitlementView[],
): ResolvedEntitlement[] {
  const byCanonical = new Map<string, EntitlementView>();

  for (const entry of entitlements) {
    const canonicalKey = resolveCanonicalEntitlementKey(entry.key);
    const existing = byCanonical.get(canonicalKey);
    if (!existing || entry.key === canonicalKey) {
      byCanonical.set(canonicalKey, entry);
    }
  }

  const catalogueRows = KNOWN_ENTITLEMENT_KEYS.map((canonicalKey) => {
    const apiEntry = byCanonical.get(canonicalKey);
    return buildResolvedEntitlement(
      apiEntry ?? {
        key: canonicalKey,
        value: null,
        enabled: false,
        expiresAt: null,
      },
      canonicalKey,
    );
  });

  const extraRows = entitlements
    .filter((entry) => !isKnownEntitlementKey(resolveCanonicalEntitlementKey(entry.key)))
    .map((entry) => buildResolvedEntitlement(entry, resolveCanonicalEntitlementKey(entry.key)));

  return [...catalogueRows, ...extraRows];
}

function buildResolvedEntitlement(
  entry: EntitlementView,
  canonicalKey: string,
): ResolvedEntitlement {
  const catalogue = isKnownEntitlementKey(canonicalKey)
    ? ENTITLEMENT_CATALOGUE[canonicalKey]
    : null;
  const upgradeHint = isKnownEntitlementKey(canonicalKey)
    ? ENTITLEMENT_UPGRADE_HINTS[canonicalKey]
    : "This capability is disabled on your current tenant plan.";

  return {
    key: entry.key,
    canonicalKey,
    value: entry.value,
    enabled: entry.enabled,
    expiresAt: entry.expiresAt,
    label: catalogue?.label ?? formatKeyAsTitle(canonicalKey),
    description: catalogue?.description ?? formatKeyAsTitle(canonicalKey),
    guidance: entry.enabled ? "Active on your current plan." : upgradeHint,
    hasInstanceKey: entry.key !== canonicalKey,
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

export function formatEntitlementExpiry(
  expiresAt: string | null,
  enabled: boolean,
): { label: string; urgent: boolean } {
  if (!enabled) {
    return { label: "—", urgent: false };
  }

  if (!expiresAt) {
    return { label: "No expiry", urgent: false };
  }

  const expires = new Date(expiresAt);
  const days = Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (days <= 0) {
    return { label: "Expired", urgent: true };
  }

  if (days <= 30) {
    return { label: `${String(days)} day${days === 1 ? "" : "s"}`, urgent: true };
  }

  return {
    label: new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(expires),
    urgent: false,
  };
}

export function groupResolvedEntitlements(
  entitlements: ResolvedEntitlement[],
): Array<{
  id: string;
  label: string;
  entries: ResolvedEntitlement[];
}> {
  const used = new Set<string>();
  const groups = ENTITLEMENT_GROUPS.map((group) => {
    const entries = group.keys
      .map((key) => entitlements.find((entry) => entry.canonicalKey === key))
      .filter((entry): entry is ResolvedEntitlement => entry != null);

    for (const entry of entries) {
      used.add(entry.canonicalKey);
    }

    return {
      id: group.id,
      label: group.label,
      entries,
    };
  }).filter((group) => group.entries.length > 0);

  const extras = entitlements.filter((entry) => !used.has(entry.canonicalKey));
  if (extras.length > 0) {
    groups.push({
      id: "other",
      label: "Other",
      entries: extras,
    });
  }

  return groups;
}
