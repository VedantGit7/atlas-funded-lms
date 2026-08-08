import type { RouteMetadata } from "@atlas/api/route-metadata";
import type { PathDetailQuery } from "../../../../../server/learning-paths/learning-path.schemas";
import {
  loadLearningPathResourceRef,
  resolvePathDetailPublishedRequirement,
} from "../../../../../server/learning-paths/learning-path.resource-loaders";

export const getRouteMetadata = {
  permission: "learning_path.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params, input }) => {
    const pathId = params["id"];
    if (!pathId) throw new Error("Missing learning path id");

    return loadLearningPathResourceRef({
      tx,
      ctx,
      pathId,
      requirePublished: resolvePathDetailPublishedRequirement(input),
    });
  },
} satisfies RouteMetadata<PathDetailQuery>;

export const putRouteMetadata = {
  permission: "learning_path.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => {
    const pathId = params["id"];
    if (!pathId) throw new Error("Missing learning path id");

    return loadLearningPathResourceRef({
      tx,
      ctx,
      pathId,
      requirePublished: false,
    });
  },
} satisfies RouteMetadata;

export const deleteRouteMetadata = {
  permission: "learning_path.delete",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: putRouteMetadata.resourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
