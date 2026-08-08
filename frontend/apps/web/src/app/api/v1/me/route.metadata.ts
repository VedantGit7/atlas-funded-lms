export const routeMetadata = {
  permission: "profile.read",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  audit: "none",
} as const;
