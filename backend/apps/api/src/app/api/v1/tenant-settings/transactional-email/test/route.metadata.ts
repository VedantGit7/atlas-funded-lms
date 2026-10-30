import type { RouteMetadata } from "@atlas/api/route-metadata";

/** Sending a test is part of setting the channel up, so it needs config.update. */
export const routeMetadata = {
  POST: {
    permission: "config.update",
    entitlement: null,
    audit: "required",
    rateLimit: "authenticatedTenantWrite",
    idempotency: "none",
  } satisfies RouteMetadata,
};
