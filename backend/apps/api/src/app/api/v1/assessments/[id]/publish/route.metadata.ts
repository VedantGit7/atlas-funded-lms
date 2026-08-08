import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadAssessmentResourceRef } from "../../../../../../server/assessments/assessment.resource-loaders";

export const publishAssessmentRouteMetadata = {
  permission: "assessment.publish",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const assessmentId = params["id"];
    if (!assessmentId) throw new Error("Missing assessment id");
    return loadAssessmentResourceRef({ tx, ctx, assessmentId, requirePublished: false });
  },
} satisfies RouteMetadata;

export const routeMetadata = publishAssessmentRouteMetadata;
