export const PLATFORM_ROUTE_REGISTRY = [
  { screenId: "P1", pathPattern: "/platform" },
  { screenId: "P2", pathPattern: "/platform/tenants/new" },
  { screenId: "P3", pathPattern: "/platform/tenants/:id" },
  { screenId: "P4", pathPattern: "/platform/feature-flags" },
  { screenId: "P5", pathPattern: "/platform/catalog" },
  { screenId: "P6", pathPattern: "/platform/audit" },
  { screenId: "P7", pathPattern: "/platform/support" },
  { screenId: "P8", pathPattern: "/platform/eventing" },
  // DoD item 8, per-tenant cost attribution. Added after the P1-P8 console was
  // specified; see tests/unit/platform/platform-console.test.ts.
  { screenId: "P9", pathPattern: "/platform/costs" },
  // Audit H6: review of blocked re-registrations and account status.
  { screenId: "P10", pathPattern: "/platform/accounts" },
] as const;

export type PlatformScreenId = (typeof PLATFORM_ROUTE_REGISTRY)[number]["screenId"];
