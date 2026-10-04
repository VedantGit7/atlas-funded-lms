import type { PlatformRouteMetadata } from "@atlas/api/route-metadata";

/** Looks up one account by email. Reads personal data, so a reason is required. */
export const routeMetadata = {
  permission: "platform.identity.manage",
  audit: "platform_scope",
  rateLimit: "platformRead",
  idempotency: "none",
  reasonRequired: true,
} satisfies PlatformRouteMetadata;
