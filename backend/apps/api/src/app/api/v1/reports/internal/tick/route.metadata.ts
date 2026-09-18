// Cron-triggered internal endpoint, guarded by CRON_SECRET (not user auth).
export const routeMetadata = {
  GET: {
    permission: "none",
    entitlement: null,
    audit: "none",
    rateLimit: "none",
    idempotency: "none",
  },
  POST: {
    permission: "none",
    entitlement: null,
    audit: "none",
    rateLimit: "none",
    idempotency: "none",
  },
};
