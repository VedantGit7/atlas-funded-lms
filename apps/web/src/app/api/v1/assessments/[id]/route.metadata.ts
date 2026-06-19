import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadAssessmentResourceRef } from "../../../../../server/assessments/assessment.resource-loaders";

export const getAssessmentRouteMetadata = {
  permission: "assessment.read",
  entitlement: null,
  audit: "none",
  rateLimit: "tenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const assessmentId = params["id"];
    if (!assessmentId) throw new Error("Missing assessment id");
    return loadAssessmentResourceRef({ tx, ctx, assessmentId, requirePublished: false });
  },
} satisfies RouteMetadata;

export const putAssessmentRouteMetadata = {
  permission: "assessment.update",
  entitlement: null,
  audit: "none",
  rateLimit: "tenantMutation",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const assessmentId = params["id"];
    if (!assessmentId) throw new Error("Missing assessment id");
    return loadAssessmentResourceRef({ tx, ctx, assessmentId, requirePublished: false });
  },
} satisfies RouteMetadata;

export const deleteAssessmentRouteMetadata = {
  permission: "assessment.delete",
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

export const routeMetadata = getAssessmentRouteMetadata;
