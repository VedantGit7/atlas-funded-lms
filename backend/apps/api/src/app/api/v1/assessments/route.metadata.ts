import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  loadAssessmentCatalogResourceRef,
  loadAssessmentCreateResourceRef,
} from "@atlas/api-server/assessments/assessment.resource-loaders";

export const getAssessmentsRouteMetadata = {
  permission: "assessment.read",
  entitlement: null,
  audit: "none",
  rateLimit: "tenantRead",
  idempotency: "none",
  resourceLoader: loadAssessmentCatalogResourceRef,
} satisfies RouteMetadata;

export const postAssessmentsRouteMetadata = {
  permission: "assessment.create",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: loadAssessmentCreateResourceRef,
} satisfies RouteMetadata;

export const routeMetadata = getAssessmentsRouteMetadata;
