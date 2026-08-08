import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

const selfArchiveResourceLoader: RouteMetadata["resourceLoader"] = ({ ctx }) =>
  Promise.resolve(
    createTenantResourceRef({
      type: "member_profile",
      id: ctx.actorMembershipId,
      tenantId: ctx.tenantId,
      ownerMembershipId: ctx.actorMembershipId,
    }),
  );

export const archiveMutationMetadata = {
  permission: "profile.update",
  entitlement: null,
  audit: "none",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: selfArchiveResourceLoader,
} satisfies RouteMetadata;

export const archiveReadMetadata = {
  permission: "profile.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: selfArchiveResourceLoader,
} satisfies RouteMetadata;
