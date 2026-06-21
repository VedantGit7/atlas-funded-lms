export type AdminScreenId =
  | "T1"
  | "T2"
  | "T3"
  | "T4"
  | "T5"
  | "T6"
  | "T7"
  | "T8"
  | "T9"
  | "T10"
  | "T11"
  | "T12"
  | "T13"
  | "T14"
  | "T15"
  | "T16"
  | "T17"
  | "T18"
  | "T19"
  | "T20"
  | "T21"
  | "T22"
  | "T23"
  | "T24";

export type AdminRouteEntitlement =
  | "branding.custom_domain.enable"
  | "certification.enable"
  | "gamification.enable"
  | "analytics.dashboard.view"
  | "data.export.enable";

export type AdminRouteContract = {
  screenId: AdminScreenId;
  pathPattern: string;
  entitlement?: AdminRouteEntitlement;
};

export const ADMIN_ROUTE_REGISTRY: readonly AdminRouteContract[] = [
  { screenId: "T1", pathPattern: "/admin" },
  { screenId: "T2", pathPattern: "/admin/members" },
  { screenId: "T3", pathPattern: "/admin/members/:id" },
  { screenId: "T4", pathPattern: "/admin/roles" },
  { screenId: "T5", pathPattern: "/admin/roles/:id" },
  { screenId: "T6", pathPattern: "/admin/branding" },
  { screenId: "T7", pathPattern: "/admin/domains", entitlement: "branding.custom_domain.enable" },
  { screenId: "T8", pathPattern: "/admin/config" },
  { screenId: "T9", pathPattern: "/admin/feature-flags" },
  { screenId: "T10", pathPattern: "/admin/entitlements" },
  { screenId: "T11", pathPattern: "/admin/competency" },
  {
    screenId: "T12",
    pathPattern: "/admin/certificates/templates",
    entitlement: "certification.enable",
  },
  { screenId: "T13", pathPattern: "/admin/certificates", entitlement: "certification.enable" },
  { screenId: "T14", pathPattern: "/admin/gamification", entitlement: "gamification.enable" },
  { screenId: "T15", pathPattern: "/admin/notifications/templates" },
  { screenId: "T16", pathPattern: "/admin/automation" },
  { screenId: "T17", pathPattern: "/admin/workflows" },
  { screenId: "T18", pathPattern: "/admin/locales" },
  { screenId: "T19", pathPattern: "/admin/extensions" },
  { screenId: "T20", pathPattern: "/admin/readiness-policy" },
  { screenId: "T21", pathPattern: "/admin/analytics", entitlement: "analytics.dashboard.view" },
  { screenId: "T22", pathPattern: "/admin/audit" },
  { screenId: "T23", pathPattern: "/admin/exports", entitlement: "data.export.enable" },
  { screenId: "T24", pathPattern: "/admin/deletion-requests" },
] as const;

/** Approved reuse paths — not duplicate admin routes. */
export const ADMIN_REUSE_ROUTE_REGISTRY = [
  { label: "Studio courses", pathPattern: "/studio/courses", screenRef: "I2" },
  { label: "Moderation queue", pathPattern: "/moderate/cases", screenRef: "M1" },
  { label: "Review & approvals", pathPattern: "/review", screenRef: "S1" },
] as const;

export const FORBIDDEN_ADMIN_DUPLICATE_ROUTES = [
  "/admin/courses",
  "/admin/assessments",
  "/admin/learning-paths",
  "/admin/moderation",
  "/admin/review",
] as const;

export function getAdminRouteByScreenId(screenId: AdminScreenId): AdminRouteContract {
  const route = ADMIN_ROUTE_REGISTRY.find((entry) => entry.screenId === screenId);
  if (!route) {
    throw new Error(`Unknown admin screen: ${screenId}`);
  }
  return route;
}

export function listAdminScreenIds(): AdminScreenId[] {
  return ADMIN_ROUTE_REGISTRY.map((entry) => entry.screenId);
}
