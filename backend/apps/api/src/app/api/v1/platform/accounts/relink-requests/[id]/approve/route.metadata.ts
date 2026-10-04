import type { PlatformRouteMetadata } from "@atlas/api/route-metadata";

export const routeMetadata = {
  permission: "platform.identity.manage",
  audit: "required",
  rateLimit: "platformMutation",
  idempotency: "required",
  reasonRequired: true,
} satisfies PlatformRouteMetadata;
