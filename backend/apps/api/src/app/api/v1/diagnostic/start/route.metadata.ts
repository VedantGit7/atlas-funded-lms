import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadPublishedDiagnosticAssessmentResourceRef } from "../../../../../server/diagnostics/diagnostic.resource-loaders";

export const routeMetadata = {
  permission: "diagnostic.start",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx }) => loadPublishedDiagnosticAssessmentResourceRef({ tx, ctx }),
} satisfies RouteMetadata;
