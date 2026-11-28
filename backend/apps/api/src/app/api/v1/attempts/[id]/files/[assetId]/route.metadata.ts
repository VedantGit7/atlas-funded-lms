import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadAttemptResourceRef } from "../../../../../../../server/attempts/attempt.resource-loaders";

/** A learner opening a file they uploaded in their own attempt (S3.4c). */
export const getAttemptFileRouteMetadata = {
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

export const routeMetadata = getAttemptFileRouteMetadata;
