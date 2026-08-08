import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadAttemptResourceRef } from "../../../../../../server/attempts/attempt.resource-loaders";

export const saveAnswerRouteMetadata = {
  permission: "attempt.submit",
  entitlement: null,
  audit: "none",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const attemptId = params["id"];
    if (!attemptId) throw new Error("Missing attempt id");
    return loadAttemptResourceRef({ tx, ctx, attemptId });
  },
} satisfies RouteMetadata;

export const routeMetadata = saveAnswerRouteMetadata;
