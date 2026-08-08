import type { RouteMetadata } from "@atlas/api/route-metadata";
import type { LearningPathListQuery } from "../../../../server/learning-paths/learning-path.schemas";
import {
  loadLearningPathCatalogResourceRef,
  loadLearningPathStudioCatalogResourceRef,
} from "../../../../server/learning-paths/learning-path.resource-loaders";

export const getRouteMetadata = {
  permission: "learning_path.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx, input }) => {
    if (input.view === "studio") {
      return loadLearningPathStudioCatalogResourceRef({ ctx });
    }
    return loadLearningPathCatalogResourceRef({ ctx });
  },
} satisfies RouteMetadata<LearningPathListQuery>;

export const postRouteMetadata = {
  permission: "learning_path.create",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadLearningPathStudioCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
