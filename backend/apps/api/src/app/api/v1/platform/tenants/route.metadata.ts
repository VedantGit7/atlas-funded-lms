import type { PlatformRouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "platform.tenant.read",
  audit: "platform_scope",
  rateLimit: "platformRead",
  idempotency: "none",
  reasonRequired: true,
} satisfies PlatformRouteMetadata;

export const postRouteMetadata = {
  permission: "platform.tenant.manage",
  audit: "required",
  rateLimit: "platformMutation",
  idempotency: "required",
  reasonRequired: true,
} satisfies PlatformRouteMetadata;
