import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { communityRepository } from "../community/community.repository";
import { communityPostNotFound } from "../community/community.errors";
import type { CreateAppealBody, CreateModerationCaseBody } from "./moderation.dto";
import { appealNotFound, moderationCaseNotFound } from "./moderation.errors";
import { moderationRepository } from "./moderation.repository";
import { loadSafeTargetProjection } from "./moderation.target-port";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

async function buildReportRelationships(
  tx: TenantTx,
  ctx: LoaderCtx,
  targetType: "post" | "comment",
  targetId: string,
): Promise<Record<string, boolean | string>> {
  const relationships = await buildModeratorRelationships(tx, ctx, targetType, targetId);

  let spaceId: string | null = null;
  if (targetType === "post") {
    const post = await communityRepository.findPostById(tx, targetId);
    spaceId = post?.space_id ?? null;
  } else {
    const comment = await communityRepository.findCommentById(tx, targetId);
    if (comment) {
      const post = await communityRepository.findPostById(tx, comment.post_id);
      spaceId = post?.space_id ?? null;
    }
  }

  if (spaceId) {
    const space = await communityRepository.findSpaceById(tx, spaceId);
    if (space && (space.visibility === "TENANT" || space.visibility === "PUBLIC")) {
      relationships["tenantVisibleSpace"] = true;
    }

    const membership = await communityRepository.findGroupMembership(
      tx,
      spaceId,
      ctx.actorMembershipId,
    );
    if (membership) {
      relationships["memberOfSpace"] = ctx.actorMembershipId;
    }
  }

  return relationships;
}

async function buildModeratorRelationships(
  tx: TenantTx,
  ctx: LoaderCtx,
  targetType?: "post" | "comment",
  targetId?: string,
): Promise<Record<string, boolean | string>> {
  const relationships: Record<string, boolean | string> = {};

  if (targetType != null && targetId != null) {
    if (targetType === "post") {
      const post = await communityRepository.findPostById(tx, targetId);
      if (post) {
        const isModerator = await communityRepository.isSpaceModerator(
          tx,
          post.space_id,
          ctx.actorMembershipId,
        );
        if (isModerator) {
          relationships["moderatorOfSpace"] = ctx.actorMembershipId;
        }
      }
    } else {
      const comment = await communityRepository.findCommentById(tx, targetId);
      if (comment) {
        const post = await communityRepository.findPostById(tx, comment.post_id);
        if (post) {
          const isModerator = await communityRepository.isSpaceModerator(
            tx,
            post.space_id,
            ctx.actorMembershipId,
          );
          if (isModerator) {
            relationships["moderatorOfSpace"] = ctx.actorMembershipId;
          }
        }
      }
    }
  }

  const isAnyModerator = await moderationRepository.isAnySpaceModerator(tx, ctx.actorMembershipId);
  if (isAnyModerator) {
    relationships["moderatorOfSpace"] = ctx.actorMembershipId;
  }

  return relationships;
}

export async function loadModerationCaseCatalogResourceRef(args: { tx: TenantTx; ctx: LoaderCtx }) {
  const relationships = await buildModeratorRelationships(args.tx, args.ctx);

  return createTenantResourceRef({
    type: "moderation_case_catalog",
    id: args.ctx.tenantId,
    tenantId: args.ctx.tenantId,
    relationships,
  });
}

export async function loadModerationCaseResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  caseId: string;
}) {
  const moderationCase = await moderationRepository.findCaseById(args.tx, args.caseId);
  if (!moderationCase || moderationCase.tenant_id !== args.ctx.tenantId) {
    throw moderationCaseNotFound();
  }

  const relationships = await buildModeratorRelationships(
    args.tx,
    args.ctx,
    moderationCase.target_type as "post" | "comment",
    moderationCase.target_id,
  );

  return createTenantResourceRef({
    type: "moderation_case",
    id: moderationCase.id,
    tenantId: args.ctx.tenantId,
    relationships,
  });
}

export async function loadModerationCaseResourceRefFromParams(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  params: Record<string, string>;
}) {
  const caseId = args.params["id"] ?? "";
  return loadModerationCaseResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    caseId,
  });
}

export async function loadModerationCaseResourceRefFromBody(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  input: CreateModerationCaseBody;
}) {
  await loadSafeTargetProjection(args.tx, {
    targetType: args.input.targetType,
    targetId: args.input.targetId,
  });

  const relationships = await buildReportRelationships(
    args.tx,
    args.ctx,
    args.input.targetType,
    args.input.targetId,
  );

  return createTenantResourceRef({
    type: "moderation_case",
    id: args.input.targetId,
    tenantId: args.ctx.tenantId,
    relationships,
  });
}

export async function loadAppealCreateResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  input: CreateAppealBody;
}) {
  const moderationCase = await moderationRepository.findCaseById(
    args.tx,
    args.input.moderationCaseId,
  );
  if (!moderationCase || moderationCase.tenant_id !== args.ctx.tenantId) {
    throw moderationCaseNotFound();
  }

  const authorMembershipId = await loadSafeTargetProjection(args.tx, {
    targetType: moderationCase.target_type as "post" | "comment",
    targetId: moderationCase.target_id,
  }).then((target) => target.authorMembershipId);

  return createTenantResourceRef({
    type: "appeal",
    id: args.input.moderationCaseId,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: authorMembershipId,
  });
}

export async function loadAppealReviewResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  appealId: string;
}) {
  const appeal = await moderationRepository.findAppealById(args.tx, args.appealId);
  if (!appeal || appeal.tenant_id !== args.ctx.tenantId) {
    throw appealNotFound();
  }

  const moderationCase = await moderationRepository.findCaseById(
    args.tx,
    appeal.moderation_case_id,
  );
  if (!moderationCase) {
    throw appealNotFound();
  }

  const relationships = await buildModeratorRelationships(
    args.tx,
    args.ctx,
    moderationCase.target_type as "post" | "comment",
    moderationCase.target_id,
  );

  return createTenantResourceRef({
    type: "appeal",
    id: appeal.id,
    tenantId: args.ctx.tenantId,
    relationships,
  });
}

export async function loadAppealReviewResourceRefFromParams(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  params: Record<string, string>;
}) {
  const appealId = args.params["id"] ?? "";
  return loadAppealReviewResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    appealId,
  });
}

export async function loadPostDeleteResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  postId: string;
}) {
  const post = await communityRepository.findPostById(args.tx, args.postId);
  if (!post || post.tenant_id !== args.ctx.tenantId) {
    throw communityPostNotFound();
  }

  const isModerator = await communityRepository.isSpaceModerator(
    args.tx,
    post.space_id,
    args.ctx.actorMembershipId,
  );

  const relationships: Record<string, boolean | string> = {};
  if (isModerator) {
    relationships["moderatorOfSpace"] = args.ctx.actorMembershipId;
  }

  return createTenantResourceRef({
    type: "post",
    id: post.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: post.author_membership_id,
    relationships,
  });
}

export async function loadPostDeleteResourceRefFromParams(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  params: Record<string, string>;
}) {
  const postId = args.params["id"] ?? "";
  return loadPostDeleteResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    postId,
  });
}
