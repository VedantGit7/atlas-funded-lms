import type { PlatformRouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "platform.tenant.read",
  audit: "none",
  rateLimit: "platformRead",
  idempotency: "none",
  reasonRequired: false,
} satisfies PlatformRouteMetadata;
