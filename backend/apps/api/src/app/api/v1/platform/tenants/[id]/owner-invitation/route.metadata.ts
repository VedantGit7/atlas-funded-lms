import type { PlatformRouteMetadata } from "@atlas/api/route-metadata";

// Emails a fresh link and invalidates the previous one: a tenant change made
// with a recorded reason, replay-safe like the lifecycle actions.
export const routeMetadata = {
  permission: "platform.tenant.manage",
  audit: "required",
  rateLimit: "platformMutation",
  idempotency: "required",
  reasonRequired: true,
} satisfies PlatformRouteMetadata;
