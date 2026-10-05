import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

type LoaderCtx = { tenantId: string; actorMembershipId: string };

const selfResourceLoader: RouteMetadata["resourceLoader"] = ({ ctx }: { ctx: LoaderCtx }) =>
  Promise.resolve(
    createTenantResourceRef({
      type: "member_profile",
      id: ctx.actorMembershipId,
      tenantId: ctx.tenantId,
      ownerMembershipId: ctx.actorMembershipId,
    }),
  );

export const mutateMeNewsfeedSaveMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "none",
  auditExempt: "own_preferences",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: selfResourceLoader,
} satisfies RouteMetadata;
