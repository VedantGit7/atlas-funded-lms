import type { PlatformRouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "platform.tenant.read",
  // Cross-tenant platform access; audited by withPlatformScope.
  audit: "platform_scope",
  rateLimit: "platformRead",
  idempotency: "none",
  reasonRequired: false,
} satisfies PlatformRouteMetadata;
