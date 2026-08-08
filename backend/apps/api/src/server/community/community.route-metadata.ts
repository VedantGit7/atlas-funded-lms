import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadPostDeleteResourceRefFromParams } from "../moderation/moderation.resource-loader";
import {
  loadCommentResourceRefFromParams,
  loadCommunitySpaceCatalogResourceRef,
  loadCommunitySpaceResourceRefFromBody,
  loadCommunitySpaceResourceRefFromParams,
  loadJoinSpaceResourceRef,
  loadPostResourceRefFromParams,
  loadReactionResourceRefFromBody,
} from "./community.resource-loader";

const communityEntitlement = "community.enable";

export const listSpacesMetadata = {
  permission: "community.space.read",
  entitlement: communityEntitlement,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadCommunitySpaceCatalogResourceRef,
} satisfies RouteMetadata;

export const manageSpacesMetadata = {
  permission: "community.space.manage",
  entitlement: communityEntitlement,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: loadCommunitySpaceCatalogResourceRef,
} satisfies RouteMetadata;

export const updateSpaceMetadata = {
  permission: "community.space.manage",
  entitlement: communityEntitlement,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, input }) =>
    loadCommunitySpaceResourceRefFromBody({
      tx,
      ctx,
      input: input as { id: string },
    }),
} satisfies RouteMetadata;

export const deleteSpaceMetadata = {
  permission: "community.space.manage",
  entitlement: communityEntitlement,
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, input }) =>
    loadCommunitySpaceResourceRefFromBody({
      tx,
      ctx,
      input: input as { id: string },
    }),
} satisfies RouteMetadata;

export const joinSpaceMetadata = {
  permission: "community.space.join",
  entitlement: communityEntitlement,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => loadJoinSpaceResourceRef({ tx, ctx, params }),
} satisfies RouteMetadata;

export const listSpacePostsMetadata = {
  permission: "post.read",
  entitlement: communityEntitlement,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) =>
    loadCommunitySpaceResourceRefFromParams({ tx, ctx, params }),
} satisfies RouteMetadata;

export const createSpacePostMetadata = {
  permission: "post.create",
  entitlement: communityEntitlement,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) =>
    loadCommunitySpaceResourceRefFromParams({ tx, ctx, params }),
} satisfies RouteMetadata;

export const listPostCommentsMetadata = {
  permission: "post.read",
  entitlement: communityEntitlement,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => loadPostResourceRefFromParams({ tx, ctx, params }),
} satisfies RouteMetadata;

export const getPostMetadata = listPostCommentsMetadata;

export const createPostCommentMetadata = {
  permission: "comment.create",
  entitlement: communityEntitlement,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) => loadPostResourceRefFromParams({ tx, ctx, params }),
} satisfies RouteMetadata;

export const updateCommentMetadata = {
  permission: "comment.update",
  entitlement: communityEntitlement,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) =>
    loadCommentResourceRefFromParams({ tx, ctx, params }),
} satisfies RouteMetadata;

export const deleteCommentMetadata = {
  permission: "comment.delete",
  entitlement: communityEntitlement,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) =>
    loadCommentResourceRefFromParams({ tx, ctx, params }),
} satisfies RouteMetadata;

export const deletePostMetadata = {
  permission: "post.delete",
  entitlement: communityEntitlement,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) =>
    loadPostDeleteResourceRefFromParams({ tx, ctx, params }),
} satisfies RouteMetadata;

export const createReactionMetadata = {
  permission: "reaction.create",
  entitlement: communityEntitlement,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, input }) =>
    loadReactionResourceRefFromBody({
      tx,
      ctx,
      input: input as { targetType: "post" | "comment"; targetId: string },
    }),
} satisfies RouteMetadata;

export const deleteReactionMetadata = createReactionMetadata;
