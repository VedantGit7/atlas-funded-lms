import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadSelfPracticeResourceRef } from "../../../../server/practice/practice.resource-loaders";

export const routeMetadata = {
  permission: "practice.start",
  entitlement: null,
  audit: "none",
  auditExempt: "learner_activity",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadSelfPracticeResourceRef({ ctx }),
} satisfies RouteMetadata;
