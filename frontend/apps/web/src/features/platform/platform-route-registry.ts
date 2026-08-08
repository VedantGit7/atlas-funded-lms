export const PLATFORM_ROUTE_REGISTRY = [
  { screenId: "P1", pathPattern: "/platform" },
  { screenId: "P2", pathPattern: "/platform/tenants/new" },
  { screenId: "P3", pathPattern: "/platform/tenants/:id" },
  { screenId: "P4", pathPattern: "/platform/feature-flags" },
  { screenId: "P5", pathPattern: "/platform/catalog" },
  { screenId: "P6", pathPattern: "/platform/audit" },
  { screenId: "P7", pathPattern: "/platform/support" },
  { screenId: "P8", pathPattern: "/platform/eventing" },
] as const;

export type PlatformScreenId = (typeof PLATFORM_ROUTE_REGISTRY)[number]["screenId"];
