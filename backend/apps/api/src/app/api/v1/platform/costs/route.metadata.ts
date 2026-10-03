import type { PlatformRouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "platform.cost.read",
  // Cross-tenant read. withPlatformScope writes the enter/exit audit rows; this
  // declares that so the compliance guard can verify it.
  audit: "platform_scope",
  rateLimit: "platformRead",
  idempotency: "none",
  reasonRequired: true,
} satisfies PlatformRouteMetadata;
