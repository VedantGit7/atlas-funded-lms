export const getRouteMetadata = {
  permission: "config.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
} as const;

export const postRouteMetadata = {
  permission: "config.update",
  mfa: "required",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "none",
} as const;

export const routeMetadata = getRouteMetadata;
