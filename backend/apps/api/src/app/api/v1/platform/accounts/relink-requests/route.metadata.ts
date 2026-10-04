import type { PlatformRouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "platform.identity.manage",
  audit: "platform_scope",
  rateLimit: "platformRead",
  idempotency: "none",
  reasonRequired: true,
} satisfies PlatformRouteMetadata;
