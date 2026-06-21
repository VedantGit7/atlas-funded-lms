import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  loadAppealCreateResourceRef,
  loadAppealReviewResourceRefFromParams,
  loadModerationCaseCatalogResourceRef,
  loadModerationCaseResourceRefFromBody,
  loadModerationCaseResourceRefFromParams,
} from "./moderation.resource-loader";

const communityEntitlement = "community.enable";

export const listModerationCasesMetadata = {
  permission: "community.moderate",
  entitlement: communityEntitlement,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadModerationCaseCatalogResourceRef,
} satisfies RouteMetadata;

export const createModerationCaseMetadata = {
  permission: "community.moderate",
  entitlement: communityEntitlement,
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, input }) =>
    loadModerationCaseResourceRefFromBody({
      tx,
      ctx,
      input: input as { targetType: "post" | "comment"; targetId: string },
    }),
} satisfies RouteMetadata;

export const decideModerationCaseMetadata = {
  permission: "community.moderate",
  entitlement: communityEntitlement,
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) =>
    loadModerationCaseResourceRefFromParams({ tx, ctx, params }),
} satisfies RouteMetadata;

export const createAppealMetadata = {
  permission: "appeal.create",
  entitlement: communityEntitlement,
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, input }) =>
    loadAppealCreateResourceRef({
      tx,
      ctx,
      input: input as { moderationCaseId: string; body: string },
    }),
} satisfies RouteMetadata;

export const reviewAppealMetadata = {
  permission: "appeal.review",
  entitlement: communityEntitlement,
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) =>
    loadAppealReviewResourceRefFromParams({ tx, ctx, params }),
} satisfies RouteMetadata;
