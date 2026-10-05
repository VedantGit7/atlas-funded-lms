import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadPracticeSessionResourceRef } from "../../../../../../server/practice/practice.resource-loaders";

export const completeSessionRouteMetadata = {
  permission: "practice.start",
  entitlement: null,
  audit: "none",
  auditExempt: "learner_activity",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const sessionId = params["id"];
    if (!sessionId) throw new Error("Missing practice session id");
    return loadPracticeSessionResourceRef({ tx, ctx, sessionId });
  },
} satisfies RouteMetadata;

export const routeMetadata = completeSessionRouteMetadata;
