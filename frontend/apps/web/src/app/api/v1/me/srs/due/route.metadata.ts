import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadSelfPracticeResourceRef } from "../../../../../../server/practice/practice.resource-loaders";

export const routeMetadata = {
  permission: "practice.start",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadSelfPracticeResourceRef({ ctx }),
} satisfies RouteMetadata;
