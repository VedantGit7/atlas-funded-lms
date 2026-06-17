export const routeMetadata = {
  permission: "membership.read",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  audit: "none",
} as const;
