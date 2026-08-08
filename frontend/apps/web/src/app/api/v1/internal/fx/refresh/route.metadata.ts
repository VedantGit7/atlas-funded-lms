// Cron-triggered internal endpoint, guarded by CRON_SECRET (not user auth).
export const routeMetadata = {
  public: true,
  permission: "pub",
  rateLimit: "publicRead",
  idempotency: "none",
} as const;
