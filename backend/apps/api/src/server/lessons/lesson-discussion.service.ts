import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { createComment, listCommentsForPost } from "../community/community.service";
import { communityRepository } from "../community/community.repository";
import type { CreateCommentBody } from "../community/community.contract";
import {
  getEffectiveFeatures,
  mergeContentMetadata,
  parseContentMetadata,
} from "./lesson-content-metadata";
import { findLessonWithModuleAndCourse, updateLessonRecord } from "./lessons.repository";
import { lessonEnrollmentRequired, lessonNotFound } from "./lessons.errors";
import { findEnrollmentForMembership } from "../courses/courses.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

async function requireLearnerLesson(tx: TenantTx, ctx: ServiceCtx, lessonId: string) {
  const lesson = await findLessonWithModuleAndCourse({ tx, lessonId });

  if (!lesson || lesson.tenantId !== ctx.tenantId) {
    throw lessonNotFound();
  }

  if (lesson.courseStatus !== "PUBLISHED" || lesson.status !== "PUBLISHED") {
    throw lessonNotFound();
  }

  const enrollment = await findEnrollmentForMembership({
    tx,
    courseId: lesson.courseId,
    membershipId: ctx.actorMembershipId,
  });

  if (!enrollment) {
    throw lessonEnrollmentRequired();
  }

  return lesson;
}

async function resolveDiscussionSpaceId(tx: TenantTx): Promise<string> {
  const spaces = await communityRepository.listAllSpacesForManage(tx);
  const first = spaces[0];
  if (first) {
    return first.id;
  }

  const created = await communityRepository.insertSpace(tx, {
    slug: "lesson-discussions",
    name: "Lesson discussions",
    visibility: "TENANT",
  });

  return created.id;
}

async function ensureDiscussionPostId(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
): Promise<string> {
  const lesson = await requireLearnerLesson(tx, ctx, lessonId);
  const metadata = parseContentMetadata(lesson.contentJson);

  if (metadata.discussionPostId) {
    const post = await communityRepository.findPostById(tx, metadata.discussionPostId);
    if (post && post.tenant_id === ctx.tenantId) {
      return metadata.discussionPostId;
    }
  }

  const spaceId = await resolveDiscussionSpaceId(tx);
  const post = await communityRepository.insertPost(tx, {
    spaceId,
    authorMembershipId: ctx.actorMembershipId,
    title: `Discussion: ${lesson.title}`,
    bodyJson: {
      version: 1,
      blocks: [
        {
          type: "paragraph",
          children: [{ type: "text", text: `Lesson discussion for ${lesson.title}.` }],
        },
      ],
    },
  });

  const merged = mergeContentMetadata(lesson.contentJson, { discussionPostId: post.id });
  await updateLessonRecord({
    tx,
    lessonId,
    contentJson: merged,
  });

  return post.id;
}

export async function listLessonComments(tx: TenantTx, ctx: ServiceCtx, lessonId: string) {
  const lesson = await requireLearnerLesson(tx, ctx, lessonId);
  const features = getEffectiveFeatures(parseContentMetadata(lesson.contentJson));

  if (!features.allowComments) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 403,
      message: "Comments are disabled for this lesson.",
    });
  }

  const postId = await ensureDiscussionPostId(tx, ctx, lessonId);
  return listCommentsForPost(tx, ctx, postId);
}

export async function createLessonComment(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  input: CreateCommentBody,
) {
  const lesson = await requireLearnerLesson(tx, ctx, lessonId);
  const features = getEffectiveFeatures(parseContentMetadata(lesson.contentJson));

  if (!features.allowComments) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 403,
      message: "Comments are disabled for this lesson.",
    });
  }

  const postId = await ensureDiscussionPostId(tx, ctx, lessonId);
  return createComment(tx, ctx, postId, input);
}
