export const routeMetadata = {
  permission: "usage.snapshot",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "none",
} as const;
