import type { PlatformRouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "platform.entitlement.manage",
  audit: "platform_scope",
  rateLimit: "platformRead",
  idempotency: "none",
  reasonRequired: true,
} satisfies PlatformRouteMetadata;

export const putRouteMetadata = {
  permission: "platform.entitlement.manage",
  audit: "required",
  rateLimit: "platformMutation",
  idempotency: "required",
  reasonRequired: true,
} satisfies PlatformRouteMetadata;
