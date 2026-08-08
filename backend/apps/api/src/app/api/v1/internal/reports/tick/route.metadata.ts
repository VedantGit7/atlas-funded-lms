// Cron-triggered internal endpoint, guarded by CRON_SECRET (not user auth).
export const routeMetadata = {
  permission: "pub",
  audit: "none",
  rateLimit: "none",
  idempotency: "none",
};
