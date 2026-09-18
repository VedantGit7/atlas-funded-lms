import type { PlatformRouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "platform.tenant.manage",
  // Cross-tenant platform access. withPlatformScope already writes enter/exit
  // audit rows; this declares that fact so the compliance guard can verify it.
  audit: "platform_scope",
  rateLimit: "platformRead",
  idempotency: "none",
  reasonRequired: false,
} satisfies PlatformRouteMetadata;
