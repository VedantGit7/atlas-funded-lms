import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { findRolePermissionGrant } from "@atlas/authorization";
import { findActiveEntitlementByKey } from "@atlas/domain-config";
import { outbox } from "@atlas/events";
import type {
  CreateCommentBody,
  CreatePostBody,
  CreateReactionBody,
  CreateSpaceBody,
  DeleteReactionBody,
  DeleteSpaceBody,
  UpdateCommentBody,
  UpdateSpaceBody,
} from "./community.contract";
import {
  COMMUNITY_AUDIT_SPACE_DELETED,
  COMMUNITY_POST_CREATED_EVENT,
  communityPostCreatedPayloadSchema,
} from "./community.events";
import {
  communityCommentNotFound,
  communityPostNotFound,
  communitySpaceNotFound,
  communitySpaceSlugConflict,
  privateSpacesEntitlementRequired,
} from "./community.errors";
import {
  extractMentionMembershipIds,
  structuredBodySchema,
  type StructuredBody,
} from "./community.dto";
import { communityRepository } from "./community.repository";
import { moderationRepository } from "../moderation/moderation.repository";
import type {
  CommentRow,
  CommunitySpaceRow,
  PostRow,
  ServiceCtx,
  Visibility,
} from "./community.types";

type TenantCommunityConfigJson = {
  community?: {
    hallOfFame?: {
      recognitionSpaceSlug?: string | undefined;
      leaderboardKey?: string | undefined;
    };
  };
};

function mapSpaceDto(
  row: CommunitySpaceRow & { is_member?: boolean; post_count?: number; member_count?: number },
  options?: { includePostCount?: boolean },
) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    visibility: row.visibility,
    isMember: Boolean(row.is_member),
    ...(options?.includePostCount && row.post_count !== undefined
      ? { postCount: row.post_count }
      : {}),
    ...(row.member_count !== undefined ? { memberCount: row.member_count } : {}),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

type PostMapCtx = {
  actorMembershipId: string;
};

type AuthorIdentity = { displayName: string | null; roleKey: string | null };

function reactionTargetKey(targetType: "post" | "comment", targetId: string): string {
  return `${targetType}:${targetId}`;
}

function toAuthorDto(membershipId: string, identity?: AuthorIdentity) {
  return {
    membershipId,
    displayName: identity?.displayName ?? null,
    roleKey: identity?.roleKey ?? null,
  };
}

async function mapPostDto(tx: TenantTx, row: PostRow, mapCtx?: PostMapCtx) {
  const bodyJson = structuredBodySchema.parse(row.body_json);
  const commentCount = await communityRepository.countCommentsForPost(tx, row.id);
  const reactionCounts = await communityRepository.reactionCountsForTarget(tx, "post", row.id);
  const identities = await communityRepository.listAuthorIdentities(tx, {
    spaceId: row.space_id,
    membershipIds: [row.author_membership_id],
  });

  let viewerReactionKeys: string[] | undefined;
  let appealableModerationCaseId: string | null | undefined;

  if (mapCtx) {
    const reactions = await communityRepository.listReactionKeysForMembershipOnTargets(tx, {
      membershipId: mapCtx.actorMembershipId,
      targets: [{ targetType: "post", targetId: row.id }],
    });
    viewerReactionKeys = reactions.get(reactionTargetKey("post", row.id)) ?? [];

    if (row.author_membership_id === mapCtx.actorMembershipId) {
      const appealable = await moderationRepository.findAppealableCaseForTarget(tx, {
        targetType: "post",
        targetId: row.id,
      });
      appealableModerationCaseId = appealable?.id ?? null;
    }
  }

  return {
    id: row.id,
    spaceId: row.space_id,
    authorMembershipId: row.author_membership_id,
    author: toAuthorDto(row.author_membership_id, identities.get(row.author_membership_id)),
    title: row.title,
    bodyJson,
    status: row.status,
    commentCount,
    reactionCounts,
    ...(viewerReactionKeys !== undefined ? { viewerReactionKeys } : {}),
    ...(appealableModerationCaseId !== undefined ? { appealableModerationCaseId } : {}),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function mapPostDtos(tx: TenantTx, rows: PostRow[], mapCtx: PostMapCtx) {
  if (rows.length === 0) return [];

  const reactions = await communityRepository.listReactionKeysForMembershipOnTargets(tx, {
    membershipId: mapCtx.actorMembershipId,
    targets: rows.map((row) => ({ targetType: "post" as const, targetId: row.id })),
  });

  const identityBySpaceMember = await resolveAuthorIdentities(
    tx,
    rows.map((row) => ({ spaceId: row.space_id, membershipId: row.author_membership_id })),
  );

  const authorPostIds = rows
    .filter((row) => row.author_membership_id === mapCtx.actorMembershipId)
    .map((row) => row.id);
  const appealableByPostId =
    authorPostIds.length > 0
      ? await moderationRepository.listAppealableCasesForTargets(tx, {
          targetType: "post",
          targetIds: authorPostIds,
        })
      : new Map<string, string>();

  return Promise.all(
    rows.map(async (row) => {
      const bodyJson = structuredBodySchema.parse(row.body_json);
      const commentCount = await communityRepository.countCommentsForPost(tx, row.id);
      const reactionCounts = await communityRepository.reactionCountsForTarget(tx, "post", row.id);

      return {
        id: row.id,
        spaceId: row.space_id,
        authorMembershipId: row.author_membership_id,
        author: toAuthorDto(
          row.author_membership_id,
          identityBySpaceMember.get(`${row.space_id}:${row.author_membership_id}`),
        ),
        title: row.title,
        bodyJson,
        status: row.status,
        commentCount,
        reactionCounts,
        viewerReactionKeys: reactions.get(reactionTargetKey("post", row.id)) ?? [],
        ...(row.author_membership_id === mapCtx.actorMembershipId
          ? { appealableModerationCaseId: appealableByPostId.get(row.id) ?? null }
          : {}),
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      };
    }),
  );
}

/**
 * Batch-resolves author identities for a list of (space, membership) pairs,
 * grouping by space so each space needs at most one lookup. Returns a map keyed
 * by `${spaceId}:${membershipId}`.
 */
async function resolveAuthorIdentities(
  tx: TenantTx,
  pairs: Array<{ spaceId: string; membershipId: string }>,
): Promise<Map<string, AuthorIdentity>> {
  const bySpace = new Map<string, Set<string>>();
  for (const pair of pairs) {
    const set = bySpace.get(pair.spaceId) ?? new Set<string>();
    set.add(pair.membershipId);
    bySpace.set(pair.spaceId, set);
  }

  const result = new Map<string, AuthorIdentity>();
  for (const [spaceId, ids] of bySpace) {
    const identities = await communityRepository.listAuthorIdentities(tx, {
      spaceId,
      membershipIds: [...ids],
    });
    for (const [membershipId, identity] of identities) {
      result.set(`${spaceId}:${membershipId}`, identity);
    }
  }
  return result;
}

async function mapCommentDto(tx: TenantTx, row: CommentRow, spaceId: string, mapCtx?: PostMapCtx) {
  const bodyJson = structuredBodySchema.parse(row.body_json);
  const reactionCounts = await communityRepository.reactionCountsForTarget(tx, "comment", row.id);
  const identities = await communityRepository.listAuthorIdentities(tx, {
    spaceId,
    membershipIds: [row.author_membership_id],
  });

  let viewerReactionKeys: string[] | undefined;
  let appealableModerationCaseId: string | null | undefined;

  if (mapCtx) {
    const reactions = await communityRepository.listReactionKeysForMembershipOnTargets(tx, {
      membershipId: mapCtx.actorMembershipId,
      targets: [{ targetType: "comment", targetId: row.id }],
    });
    viewerReactionKeys = reactions.get(reactionTargetKey("comment", row.id)) ?? [];

    if (row.author_membership_id === mapCtx.actorMembershipId) {
      const appealable = await moderationRepository.findAppealableCaseForTarget(tx, {
        targetType: "comment",
        targetId: row.id,
      });
      appealableModerationCaseId = appealable?.id ?? null;
    }
  }

  return {
    id: row.id,
    postId: row.post_id,
    parentCommentId: row.parent_comment_id,
    authorMembershipId: row.author_membership_id,
    author: toAuthorDto(row.author_membership_id, identities.get(row.author_membership_id)),
    bodyJson,
    status: row.status,
    reactionCounts,
    ...(viewerReactionKeys !== undefined ? { viewerReactionKeys } : {}),
    ...(appealableModerationCaseId !== undefined ? { appealableModerationCaseId } : {}),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function mapCommentDtos(
  tx: TenantTx,
  rows: CommentRow[],
  spaceId: string,
  mapCtx: PostMapCtx,
) {
  if (rows.length === 0) return [];

  const reactions = await communityRepository.listReactionKeysForMembershipOnTargets(tx, {
    membershipId: mapCtx.actorMembershipId,
    targets: rows.map((row) => ({ targetType: "comment" as const, targetId: row.id })),
  });

  const identities = await communityRepository.listAuthorIdentities(tx, {
    spaceId,
    membershipIds: rows.map((row) => row.author_membership_id),
  });

  const authorCommentIds = rows
    .filter((row) => row.author_membership_id === mapCtx.actorMembershipId)
    .map((row) => row.id);
  const appealableByCommentId =
    authorCommentIds.length > 0
      ? await moderationRepository.listAppealableCasesForTargets(tx, {
          targetType: "comment",
          targetIds: authorCommentIds,
        })
      : new Map<string, string>();

  return Promise.all(
    rows.map(async (row) => {
      const bodyJson = structuredBodySchema.parse(row.body_json);
      const reactionCounts = await communityRepository.reactionCountsForTarget(
        tx,
        "comment",
        row.id,
      );

      return {
        id: row.id,
        postId: row.post_id,
        parentCommentId: row.parent_comment_id,
        authorMembershipId: row.author_membership_id,
        author: toAuthorDto(row.author_membership_id, identities.get(row.author_membership_id)),
        bodyJson,
        status: row.status,
        reactionCounts,
        viewerReactionKeys: reactions.get(reactionTargetKey("comment", row.id)) ?? [],
        ...(row.author_membership_id === mapCtx.actorMembershipId
          ? { appealableModerationCaseId: appealableByCommentId.get(row.id) ?? null }
          : {}),
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      };
    }),
  );
}

async function assertPrivateSpacesEntitlement(
  tx: TenantTx,
  ctx: ServiceCtx,
  visibility: Visibility,
) {
  if (visibility !== "PRIVATE" && visibility !== "UNLISTED") {
    return;
  }

  const entitlement = await findActiveEntitlementByKey(tx, "community.private_spaces.enable");
  if (!entitlement) {
    throw privateSpacesEntitlementRequired();
  }
}

async function resolveValidatedMentions(tx: TenantTx, body: StructuredBody): Promise<string[]> {
  const requested = extractMentionMembershipIds(body);
  if (requested.length === 0) return [];

  const active = await communityRepository.countActiveMemberships(tx, requested);
  const activeSet = new Set(active);
  return requested.filter((id) => activeSet.has(id));
}

export async function resolveHallOfFameConfig(tx: TenantTx) {
  const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
    select config_json
    from tenant_config
    limit 1
  `;

  const configJson = rows[0]?.config_json as TenantCommunityConfigJson | undefined;
  const hallOfFame = configJson?.community?.hallOfFame;

  let recognitionSpaceId: string | null = null;
  let leaderboardId: string | null = null;

  if (hallOfFame?.recognitionSpaceSlug) {
    const space = await communityRepository.findSpaceBySlug(tx, hallOfFame.recognitionSpaceSlug);
    recognitionSpaceId = space?.id ?? null;
  }

  if (hallOfFame?.leaderboardKey) {
    const leaderboardRows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from leaderboard_definitions
      where key = ${hallOfFame.leaderboardKey}
        and status = 'ACTIVE'
      limit 1
    `;
    leaderboardId = leaderboardRows[0]?.id ?? null;
  }

  return {
    recognitionSpaceId,
    leaderboardId,
  };
}

export async function listSpaces(tx: TenantTx, ctx: ServiceCtx) {
  const manageGrant = await findRolePermissionGrant({
    tx,
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    permissionKey: "community.space.manage",
  });

  if ((manageGrant?.roleKeys.length ?? 0) > 0) {
    const rows = await communityRepository.listAllSpacesForManage(tx);
    return {
      data: {
        items: await Promise.all(
          rows.map(async (row) => {
            const [membership, memberCount] = await Promise.all([
              communityRepository.findGroupMembership(tx, row.id, ctx.actorMembershipId),
              communityRepository.countMembersForSpace(tx, row.id),
            ]);
            return mapSpaceDto(
              { ...row, is_member: Boolean(membership), member_count: memberCount },
              { includePostCount: true },
            );
          }),
        ),
      },
    };
  }

  const rows = await communityRepository.listVisibleSpaces(tx, {
    actorMembershipId: ctx.actorMembershipId,
    includePostCounts: true,
  });

  return {
    data: {
      items: rows.map((row) => mapSpaceDto(row, { includePostCount: true })),
    },
  };
}

export async function createSpace(tx: TenantTx, ctx: ServiceCtx, input: CreateSpaceBody) {
  await assertPrivateSpacesEntitlement(tx, ctx, input.visibility);

  const existing = await communityRepository.findSpaceBySlugIncludingDeleted(tx, input.slug);
  if (existing && existing.deleted_at === null) {
    throw communitySpaceSlugConflict();
  }

  const created = await communityRepository.insertSpace(tx, {
    slug: input.slug,
    name: input.name,
    visibility: input.visibility,
    ...(input.configJson !== undefined ? { configJson: input.configJson } : {}),
  });

  return { data: mapSpaceDto({ ...created, is_member: false }) };
}

export async function updateSpace(tx: TenantTx, ctx: ServiceCtx, input: UpdateSpaceBody) {
  const existing = await communityRepository.findSpaceById(tx, input.id);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw communitySpaceNotFound();
  }

  const nextVisibility = input.visibility ?? existing.visibility;
  await assertPrivateSpacesEntitlement(tx, ctx, nextVisibility);

  if (input.slug && input.slug !== existing.slug) {
    const conflict = await communityRepository.findSpaceBySlugIncludingDeleted(tx, input.slug);
    if (conflict && conflict.deleted_at === null && conflict.id !== existing.id) {
      throw communitySpaceSlugConflict();
    }
  }

  const updated = await communityRepository.updateSpace(tx, {
    spaceId: input.id,
    ...(input.slug !== undefined ? { slug: input.slug } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    ...(input.configJson !== undefined ? { configJson: input.configJson } : {}),
  });

  if (!updated) {
    throw communitySpaceNotFound();
  }

  const membership = await communityRepository.findGroupMembership(
    tx,
    updated.id,
    ctx.actorMembershipId,
  );

  return { data: mapSpaceDto({ ...updated, is_member: Boolean(membership) }) };
}

export async function deleteSpace(tx: TenantTx, ctx: ServiceCtx, input: DeleteSpaceBody) {
  const existing = await communityRepository.findSpaceById(tx, input.id);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw communitySpaceNotFound();
  }

  const deleted = await communityRepository.softDeleteSpace(tx, input.id);
  if (!deleted) {
    throw communitySpaceNotFound();
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: COMMUNITY_AUDIT_SPACE_DELETED,
      target: { type: "community_space", id: input.id },
      before: { slug: existing.slug, name: existing.name, visibility: existing.visibility },
      after: null,
      reason: null,
      metadata: {},
    },
  );

  return { data: { id: input.id, deleted: true as const } };
}

export async function joinSpace(tx: TenantTx, ctx: ServiceCtx, spaceId: string) {
  const space = await communityRepository.findSpaceById(tx, spaceId);
  if (!space || space.tenant_id !== ctx.tenantId) {
    throw communitySpaceNotFound();
  }

  const membership = await communityRepository.insertGroupMembership(tx, {
    spaceId,
    membershipId: ctx.actorMembershipId,
  });

  return {
    data: {
      spaceId,
      membershipId: membership.membership_id,
      joined: true,
    },
  };
}

export async function listPostsInSpace(tx: TenantTx, ctx: ServiceCtx, spaceId: string) {
  const space = await communityRepository.findSpaceById(tx, spaceId);
  if (!space || space.tenant_id !== ctx.tenantId) {
    throw communitySpaceNotFound();
  }

  const posts = await communityRepository.listPostsInSpace(tx, spaceId);

  return {
    data: {
      items: await mapPostDtos(tx, posts, { actorMembershipId: ctx.actorMembershipId }),
    },
  };
}

export async function createPost(
  tx: TenantTx,
  ctx: ServiceCtx,
  spaceId: string,
  input: CreatePostBody,
) {
  const space = await communityRepository.findSpaceById(tx, spaceId);
  if (!space || space.tenant_id !== ctx.tenantId) {
    throw communitySpaceNotFound();
  }

  const mentionMembershipIds = await resolveValidatedMentions(tx, input.bodyJson);

  const created = await communityRepository.insertPost(tx, {
    spaceId,
    authorMembershipId: ctx.actorMembershipId,
    ...(input.title !== undefined ? { title: input.title } : {}),
    bodyJson: input.bodyJson,
  });

  if (mentionMembershipIds.length > 0) {
    await communityRepository.insertMentions(tx, {
      sourceType: "post",
      sourceId: created.id,
      membershipIds: mentionMembershipIds,
    });
  }

  const payload = communityPostCreatedPayloadSchema.parse({
    postId: created.id,
    spaceId,
    authorMembershipId: ctx.actorMembershipId,
    mentionMembershipIds,
  });

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: COMMUNITY_POST_CREATED_EVENT,
    aggregateType: "post",
    aggregateId: created.id,
    payload,
    idempotencyKey: ctx.idempotencyKey ?? `community.post.created:${created.id}`,
  });

  return { data: await mapPostDto(tx, created, { actorMembershipId: ctx.actorMembershipId }) };
}

export async function listCommentsForPost(tx: TenantTx, ctx: ServiceCtx, postId: string) {
  const post = await communityRepository.findPostById(tx, postId);
  if (!post || post.tenant_id !== ctx.tenantId) {
    throw communityPostNotFound();
  }

  const comments = await communityRepository.listCommentsForPost(tx, postId);

  return {
    data: {
      items: await mapCommentDtos(tx, comments, post.space_id, {
        actorMembershipId: ctx.actorMembershipId,
      }),
    },
  };
}

export async function createComment(
  tx: TenantTx,
  ctx: ServiceCtx,
  postId: string,
  input: CreateCommentBody,
) {
  const post = await communityRepository.findPostById(tx, postId);
  if (!post || post.tenant_id !== ctx.tenantId) {
    throw communityPostNotFound();
  }

  // Threaded replies must point at a live comment on the same post. Reject
  // cross-post / deleted / unknown parents so the tree stays well-formed.
  if (input.parentCommentId) {
    const parent = await communityRepository.findCommentById(tx, input.parentCommentId);
    if (!parent || parent.tenant_id !== ctx.tenantId || parent.post_id !== postId) {
      throw communityCommentNotFound();
    }
  }

  const mentionMembershipIds = await resolveValidatedMentions(tx, input.bodyJson);

  const created = await communityRepository.insertComment(tx, {
    postId,
    authorMembershipId: ctx.actorMembershipId,
    bodyJson: input.bodyJson,
    parentCommentId: input.parentCommentId ?? null,
  });

  if (mentionMembershipIds.length > 0) {
    await communityRepository.insertMentions(tx, {
      sourceType: "comment",
      sourceId: created.id,
      membershipIds: mentionMembershipIds,
    });
  }

  return {
    data: await mapCommentDto(tx, created, post.space_id, {
      actorMembershipId: ctx.actorMembershipId,
    }),
  };
}

export async function updateComment(
  tx: TenantTx,
  ctx: ServiceCtx,
  commentId: string,
  input: UpdateCommentBody,
) {
  const existing = await communityRepository.findCommentById(tx, commentId);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw communityCommentNotFound();
  }

  if (existing.author_membership_id !== ctx.actorMembershipId) {
    throw communityCommentNotFound();
  }

  const mentionMembershipIds = await resolveValidatedMentions(tx, input.bodyJson);

  const updated = await communityRepository.updateCommentBody(tx, commentId, input.bodyJson);
  if (!updated) {
    throw communityCommentNotFound();
  }

  const post = await communityRepository.findPostByIdIncludingDeleted(tx, updated.post_id);

  await tx.$executeRaw`
    delete from mentions
    where source_type = 'comment'
      and source_id = ${commentId}::uuid
  `;

  if (mentionMembershipIds.length > 0) {
    await communityRepository.insertMentions(tx, {
      sourceType: "comment",
      sourceId: commentId,
      membershipIds: mentionMembershipIds,
    });
  }

  return {
    data: await mapCommentDto(tx, updated, post?.space_id ?? "", {
      actorMembershipId: ctx.actorMembershipId,
    }),
  };
}

export async function deleteComment(tx: TenantTx, ctx: ServiceCtx, commentId: string) {
  const existing = await communityRepository.findCommentById(tx, commentId);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw communityCommentNotFound();
  }

  const deleted = await communityRepository.softDeleteComment(tx, commentId);
  if (!deleted) {
    throw communityCommentNotFound();
  }

  if (existing.author_membership_id !== ctx.actorMembershipId) {
    await auditWriter.write(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        platformPrincipalId: null,
        requestId: ctx.requestId,
      },
      {
        action: "community.moderation.decided",
        target: { type: "comment", id: commentId },
        before: { deleted: false },
        after: { deleted: true, contentAction: "delete" },
        reason: null,
        metadata: { moderationPath: true },
      },
    );
  }

  return { data: { id: commentId, deleted: true as const } };
}

export async function createReaction(tx: TenantTx, ctx: ServiceCtx, input: CreateReactionBody) {
  if (input.targetType === "post") {
    const post = await communityRepository.findPostById(tx, input.targetId);
    if (!post) throw communityPostNotFound();
  } else {
    const comment = await communityRepository.findCommentById(tx, input.targetId);
    if (!comment) throw communityCommentNotFound();
  }

  const result = await communityRepository.upsertReaction(tx, {
    membershipId: ctx.actorMembershipId,
    targetType: input.targetType,
    targetId: input.targetId,
    reactionKey: input.reactionKey,
  });

  return {
    data: {
      targetType: input.targetType,
      targetId: input.targetId,
      reactionKey: input.reactionKey,
      created: result.created,
    },
  };
}

export async function deleteReaction(tx: TenantTx, ctx: ServiceCtx, input: DeleteReactionBody) {
  const removed = await communityRepository.deleteReaction(tx, {
    membershipId: ctx.actorMembershipId,
    targetType: input.targetType,
    targetId: input.targetId,
    reactionKey: input.reactionKey,
  });

  return {
    data: {
      targetType: input.targetType,
      targetId: input.targetId,
      reactionKey: input.reactionKey,
      created: false,
      removed,
    },
  };
}

export async function getPostById(tx: TenantTx, ctx: ServiceCtx, postId: string) {
  const post = await communityRepository.findPostById(tx, postId);
  if (!post || post.tenant_id !== ctx.tenantId) {
    throw communityPostNotFound();
  }

  return {
    data: await mapPostDto(tx, post, { actorMembershipId: ctx.actorMembershipId }),
  };
}

export async function deletePost(tx: TenantTx, ctx: ServiceCtx, postId: string) {
  const existing = await communityRepository.findPostById(tx, postId);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw communityPostNotFound();
  }

  const deleted = await communityRepository.softDeletePost(tx, postId);
  if (!deleted) {
    throw communityPostNotFound();
  }

  if (existing.author_membership_id !== ctx.actorMembershipId) {
    await auditWriter.write(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        platformPrincipalId: null,
        requestId: ctx.requestId,
      },
      {
        action: "community.moderation.decided",
        target: { type: "post", id: postId },
        before: { deleted: false },
        after: { deleted: true, contentAction: "delete" },
        reason: null,
        metadata: { moderationPath: true },
      },
    );
  }

  return { data: { id: postId, deleted: true as const } };
}
