import type { TenantTx } from "@atlas/db";
import { communityRepository } from "../community/community.repository";
import { structuredBodyToPlainText } from "./moderation.dto";
import { moderationTargetNotFound } from "./moderation.errors";
import type { ModerationTargetType } from "./moderation.contract";
import type { SafeTargetProjection } from "./moderation.types";

export async function loadSafeTargetProjection(
  tx: TenantTx,
  args: { targetType: ModerationTargetType; targetId: string; includeDeleted?: boolean },
): Promise<SafeTargetProjection> {
  if (args.targetType === "post") {
    const post = args.includeDeleted
      ? await communityRepository.findPostByIdIncludingDeleted(tx, args.targetId)
      : await communityRepository.findPostById(tx, args.targetId);
    if (!post) {
      throw moderationTargetNotFound();
    }

    return {
      targetType: "post",
      targetId: post.id,
      authorMembershipId: post.author_membership_id,
      previewText: structuredBodyToPlainText(post.body_json),
      title: post.title,
      deleted: post.deleted_at != null || post.status === "deleted",
    };
  }

  const comment = args.includeDeleted
    ? await communityRepository.findCommentByIdIncludingDeleted(tx, args.targetId)
    : await communityRepository.findCommentById(tx, args.targetId);
  if (!comment) {
    throw moderationTargetNotFound();
  }

  return {
    targetType: "comment",
    targetId: comment.id,
    authorMembershipId: comment.author_membership_id,
    previewText: structuredBodyToPlainText(comment.body_json),
    title: null,
    deleted: comment.deleted_at != null || comment.status === "deleted",
  };
}

export async function applyRegisteredContentAction(
  tx: TenantTx,
  args: {
    targetType: ModerationTargetType;
    targetId: string;
    contentAction: "delete";
  },
): Promise<void> {
  if (args.targetType === "post") {
    const deleted = await communityRepository.softDeletePost(tx, args.targetId);
    if (!deleted) {
      throw moderationTargetNotFound();
    }
    return;
  }

  const deleted = await communityRepository.softDeleteComment(tx, args.targetId);
  if (!deleted) {
    throw moderationTargetNotFound();
  }
}

export async function resolveTargetAuthorMembershipId(
  tx: TenantTx,
  args: { targetType: ModerationTargetType; targetId: string },
): Promise<string> {
  const projection = await loadSafeTargetProjection(tx, { ...args, includeDeleted: true });
  return projection.authorMembershipId;
}
