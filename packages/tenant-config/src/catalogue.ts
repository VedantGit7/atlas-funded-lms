export const KNOWN_ENTITLEMENT_KEYS = [
  "branding.custom_domain.enable",
  "community.enable",
  "certification.enable",
  "gamification.enable",
  "analytics.dashboard.view",
  "data.export.enable",
  "community.private_spaces.enable",
] as const;

export type KnownEntitlementKey = (typeof KNOWN_ENTITLEMENT_KEYS)[number];

export const ENTITLEMENT_BACKED_FEATURE_FLAG_KEYS = [
  "community.enable",
  "community.private_spaces.enable",
  "certification.enable",
  "gamification.enable",
  "branding.custom_domain.enable",
  "data.export.enable",
] as const;

export const OVERRIDABLE_FEATURE_FLAG_KEYS = ["analytics.dashboard.view"] as const;

export const KNOWN_EXTENSION_POINT_KEYS = ["item_type_renderer"] as const;

export const FORBIDDEN_MANIFEST_TERMS = [
  "challenge.purchased",
  "challenge.passed",
  "challenge.failed",
  "trader.funded",
  "funded.revoked",
  "challenge checkout",
  "payment processing",
  "trading account",
  "match-trader",
  "matchtrader",
] as const;

export const LEGAL_APPROVAL_STATUSES = ["pending_approval", "approved"] as const;

export type LegalApprovalStatus = (typeof LEGAL_APPROVAL_STATUSES)[number];

export const APPLY_ENVIRONMENTS = ["development", "test", "staging", "production"] as const;

export type ApplyEnvironment = (typeof APPLY_ENVIRONMENTS)[number];
