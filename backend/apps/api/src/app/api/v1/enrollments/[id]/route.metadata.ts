import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadEnrollmentManageResourceRef } from "../../../../../server/enrollments/enrollments.service";

export const deleteEnrollmentRouteMetadata = {
  permission: "enrollment.manage",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const enrollmentId = params["id"];
    if (!enrollmentId) throw new Error("Missing enrollment id");
    return loadEnrollmentManageResourceRef({ tx, ctx, enrollmentId });
  },
} satisfies RouteMetadata;
