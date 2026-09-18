// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import type { DeleteSpaceBody, UpdateSpaceBody } from "./community.contract";
import { communityPostNotFound, communitySpaceNotFound } from "./community.errors";
import { communityRepository } from "./community.repository";
import type { CommunitySpaceRow, Visibility } from "./community.types";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

function isTenantVisible(visibility: Visibility): boolean {
  return visibility === "TENANT" || visibility === "PUBLIC";
}

async function buildSpaceRelationships(
  tx: TenantTx,
  space: CommunitySpaceRow,
  actorMembershipId: string,
): Promise<Record<string, boolean | string>> {
  const relationships: Record<string, boolean | string> = {};

  if (isTenantVisible(space.visibility)) {
    relationships["tenantVisibleSpace"] = true;
  }

  const membership = await communityRepository.findGroupMembership(tx, space.id, actorMembershipId);
  if (membership) {
    relationships["memberOfSpace"] = actorMembershipId;
  }

  const isModerator = await communityRepository.isSpaceModerator(tx, space.id, actorMembershipId);
  if (isModerator) {
    relationships["moderatorOfSpace"] = actorMembershipId;
  }

  return relationships;
}

export function loadCommunitySpaceCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "community_space_catalog",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
      // `community.space.read` is relationship-gated (memberOfSpace / tenantVisibleSpace)
      // because it's reused for reading a single space. The catalog *listing* has no
      // single space to relate to, and `listVisibleSpaces` already filters rows to
      // tenant/public spaces plus the actor's memberships. Marking the catalog surface
      // tenant-visible lets any tenant member with the grant browse it, while per-space
      // visibility stays enforced in SQL.
      relationships: { tenantVisibleSpace: true },
    }),
  );
}

export async function loadCommunitySpaceResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  spaceId: string;
}) {
  const space = await communityRepository.findSpaceById(args.tx, args.spaceId);

  if (!space || space.tenant_id !== args.ctx.tenantId) {
    throw communitySpaceNotFound();
  }

  const relationships = await buildSpaceRelationships(args.tx, space, args.ctx.actorMembershipId);

  return createTenantResourceRef({
    type: "community_space",
    id: space.id,
    tenantId: args.ctx.tenantId,
    relationships,
  });
}

export async function loadCommunitySpaceResourceRefFromParams(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  params: Record<string, string>;
}) {
  const spaceId = args.params["id"] ?? "";
  return loadCommunitySpaceResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    spaceId,
  });
}

export async function loadCommunitySpaceResourceRefFromBody(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  input: UpdateSpaceBody | DeleteSpaceBody;
}) {
  return loadCommunitySpaceResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    spaceId: args.input.id,
  });
}

export async function loadPostResourceRef(args: { tx: TenantTx; ctx: LoaderCtx; postId: string }) {
  const post = await communityRepository.findPostById(args.tx, args.postId);

  if (!post || post.tenant_id !== args.ctx.tenantId) {
    throw communityPostNotFound();
  }

  const space = await communityRepository.findSpaceById(args.tx, post.space_id);
  if (!space) {
    throw communityPostNotFound();
  }

  const relationships = await buildSpaceRelationships(args.tx, space, args.ctx.actorMembershipId);

  return createTenantResourceRef({
    type: "post",
    id: post.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: post.author_membership_id,
    relationships,
  });
}

export async function loadPostResourceRefFromParams(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  params: Record<string, string>;
}) {
  const postId = args.params["id"] ?? "";
  return loadPostResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    postId,
  });
}

export async function loadCommentResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  commentId: string;
}) {
  const comment = await communityRepository.findCommentById(args.tx, args.commentId);

  if (!comment || comment.tenant_id !== args.ctx.tenantId) {
    throw communityPostNotFound();
  }

  const post = await communityRepository.findPostById(args.tx, comment.post_id);
  if (!post) {
    throw communityPostNotFound();
  }

  const space = await communityRepository.findSpaceById(args.tx, post.space_id);
  if (!space) {
    throw communityPostNotFound();
  }

  const relationships = await buildSpaceRelationships(args.tx, space, args.ctx.actorMembershipId);

  return createTenantResourceRef({
    type: "comment",
    id: comment.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: comment.author_membership_id,
    relationships,
  });
}

export async function loadCommentResourceRefFromParams(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  params: Record<string, string>;
}) {
  const commentId = args.params["id"] ?? "";
  return loadCommentResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    commentId,
  });
}

export async function loadReactionResourceRefFromBody(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  input: {
    targetType: "post" | "comment";
    targetId: string;
  };
}) {
  if (args.input.targetType === "post") {
    return loadPostResourceRef({
      tx: args.tx,
      ctx: args.ctx,
      postId: args.input.targetId,
    });
  }

  const comment = await communityRepository.findCommentById(args.tx, args.input.targetId);
  if (!comment) {
    throw communityPostNotFound();
  }

  return loadPostResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    postId: comment.post_id,
  });
}

export async function loadJoinSpaceResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  params: Record<string, string>;
}) {
  const spaceId = args.params["id"] ?? "";
  const space = await communityRepository.findSpaceById(args.tx, spaceId);

  if (!space || space.tenant_id !== args.ctx.tenantId) {
    throw communitySpaceNotFound();
  }

  return createTenantResourceRef({
    type: "group_membership",
    id: space.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: args.ctx.actorMembershipId,
  });
}
