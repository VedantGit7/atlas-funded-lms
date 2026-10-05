import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadModuleLessonsResourceRef } from "../../../../../../server/courses/load-course-resource-ref";

const resourceLoader = async ({
  tx,
  ctx,
  params,
}: {
  tx: Parameters<typeof loadModuleLessonsResourceRef>[0]["tx"];
  ctx: Parameters<typeof loadModuleLessonsResourceRef>[0]["ctx"];
  params: Record<string, string>;
}) => {
  const moduleId = params["id"];
  if (!moduleId) throw new Error("Missing module id");

  return await loadModuleLessonsResourceRef({
    tx,
    ctx,
    moduleId,
    requirePublished: true,
  });
};

export const getRouteMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader,
} satisfies RouteMetadata;

export const putRouteMetadata = {
  permission: "progress.read",
  entitlement: null,
  audit: "none",
  auditExempt: "learner_activity",
  rateLimit: "tenantMutation",
  idempotency: "none",
  resourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = getRouteMetadata;
