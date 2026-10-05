import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadAssessmentResourceRef } from "../../../../../../server/assessments/assessment.resource-loaders";

export const startAttemptRouteMetadata = {
  permission: "attempt.start",
  entitlement: null,
  audit: "none",
  auditExempt: "learner_activity",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const assessmentId = params["id"];
    if (!assessmentId) throw new Error("Missing assessment id");
    return loadAssessmentResourceRef({ tx, ctx, assessmentId, requirePublished: true });
  },
} satisfies RouteMetadata;

export const routeMetadata = startAttemptRouteMetadata;
