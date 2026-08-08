import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadAttemptResourceRef } from "../../../../../server/attempts/attempt.resource-loaders";

export const getAttemptRouteMetadata = {
  permission: "attempt.read",
  entitlement: null,
  audit: "none",
  rateLimit: "tenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const attemptId = params["id"];
    if (!attemptId) throw new Error("Missing attempt id");
    return loadAttemptResourceRef({ tx, ctx, attemptId });
  },
} satisfies RouteMetadata;

export const routeMetadata = getAttemptRouteMetadata;
