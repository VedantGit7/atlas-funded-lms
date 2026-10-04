export const routeMetadata = {
  permission: "config.update",
  mfa: "required",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "none",
} as const;
