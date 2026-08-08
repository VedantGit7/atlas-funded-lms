import type { RouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  public: true,
  permission: "pub",
  rateLimit: "publicRead",
  idempotency: "none",
} satisfies RouteMetadata;
