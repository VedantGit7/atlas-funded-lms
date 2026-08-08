import type { PlatformRouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "platform.catalog.manage",
  audit: "platform_scope",
  rateLimit: "platformRead",
  idempotency: "none",
  reasonRequired: true,
} satisfies PlatformRouteMetadata;

export const postRouteMetadata = {
  permission: "platform.catalog.manage",
  audit: "required",
  rateLimit: "platformMutation",
  idempotency: "required",
  reasonRequired: true,
} satisfies PlatformRouteMetadata;
