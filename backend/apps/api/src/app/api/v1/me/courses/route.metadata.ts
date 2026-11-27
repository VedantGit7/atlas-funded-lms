import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

/**
 * The learner's own courses and progress: the same permission and resource as
 * listing one's own enrollments (`GET /api/v1/enrollments` without a course).
 */
export const routeMetadata = {
  permission: "enrollment.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) =>
    createTenantResourceRef({
      type: "member_enrollments",
      id: ctx.actorMembershipId,
      tenantId: ctx.tenantId,
      ownerMembershipId: ctx.actorMembershipId,
      relationships: { selfEnrollmentList: ctx.actorMembershipId },
    }),
} satisfies RouteMetadata;
