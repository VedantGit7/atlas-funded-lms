import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { findCourseAuthProjection } from "../courses/courses.repository";
import { courseNotFound } from "../courses/courses.errors";
import { findLessonWithModuleAndCourse } from "../lessons/lessons.repository";
import { lessonNotFound } from "../lessons/lessons.errors";
import type {
  CreateTagBody,
  ReplaceCourseTagsBody,
  ReplaceLessonTagsBody,
  TagListQuery,
  TagSummary,
  UpdateTagBody,
} from "./tag-schemas";
import { tagNotFound } from "./tags.errors";
import {
  attachTagToCourse,
  attachTagToLesson,
  detachTagFromCourse,
  detachTagFromLesson,
  findTagById,
  fromApiTagVisibility,
  insertTag,
  listTags,
  listTagsForCourse,
  listTagsForLesson,
  replaceCourseTags,
  replaceLessonTags,
  slugifyTagTitle,
  softDeleteTag,
  tagSlugExists,
  toApiTagVisibility,
  updateTagRecord,
  validateTagIdsExist,
  type TagRow,
} from "./tags.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function mapTagSummary(row: TagRow): TagSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    visibility: toApiTagVisibility(row.visibility),
  };
}

function mapTagDetail(row: TagRow) {
  return {
    ...mapTagSummary(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireOwnedLesson(tx: TenantTx, ctx: ServiceCtx, lessonId: string) {
  const lesson = await findLessonWithModuleAndCourse({ tx, lessonId });

  if (!lesson || lesson.tenantId !== ctx.tenantId) {
    throw lessonNotFound();
  }

  if (lesson.createdByMembershipId !== ctx.actorMembershipId) {
    throw lessonNotFound();
  }

  return lesson;
}

async function requireOwnedCourse(tx: TenantTx, ctx: ServiceCtx, courseId: string) {
  const course = await findCourseAuthProjection({ tx, courseId });

  if (!course || course.tenantId !== ctx.tenantId) {
    throw courseNotFound();
  }

  if (course.createdByMembershipId !== ctx.actorMembershipId) {
    throw courseNotFound();
  }

  return course;
}

export async function listTenantTags(tx: TenantTx, ctx: ServiceCtx, query?: TagListQuery) {
  const items = await listTags({
    tx,
    tenantId: ctx.tenantId,
    ...(query?.publicOnly ? { publicOnly: true } : {}),
    ...(query?.visibility ? { visibility: fromApiTagVisibility(query.visibility) } : {}),
  });

  return {
    data: {
      items: items.map(mapTagSummary),
    },
  };
}

export async function createTag(tx: TenantTx, ctx: ServiceCtx, input: CreateTagBody) {
  const title = input.title.trim();
  const slug = slugifyTagTitle(title);

  if (!slug) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Tag title could not be slugified.",
    });
  }

  if (await tagSlugExists({ tx, tenantId: ctx.tenantId, slug })) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "A tag with this title already exists.",
    });
  }

  const created = await insertTag({
    tx,
    tenantId: ctx.tenantId,
    title,
    slug,
    description: input.description?.trim() || null,
    visibility: fromApiTagVisibility(input.visibility ?? "public"),
  });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "tag.create",
      target: { type: "tag", id: created.id },
      before: null,
      after: { id: created.id, title: created.title, visibility: created.visibility },
      reason: null,
      metadata: {},
    },
  );

  return { data: mapTagDetail(created) };
}

export async function getTag(tx: TenantTx, ctx: ServiceCtx, tagId: string) {
  const tag = await findTagById({ tx, tenantId: ctx.tenantId, tagId });
  if (!tag) throw tagNotFound();
  return { data: mapTagDetail(tag) };
}

export async function updateTag(
  tx: TenantTx,
  ctx: ServiceCtx,
  tagId: string,
  input: UpdateTagBody,
) {
  const existing = await findTagById({ tx, tenantId: ctx.tenantId, tagId });
  if (!existing) throw tagNotFound();

  const title = input.title?.trim() ?? existing.title;
  const slug = input.title ? slugifyTagTitle(title) : existing.slug;
  const description =
    input.description !== undefined ? input.description.trim() || null : existing.description;
  const visibility = input.visibility
    ? fromApiTagVisibility(input.visibility)
    : existing.visibility;

  const updated = await updateTagRecord({
    tx,
    tenantId: ctx.tenantId,
    tagId,
    title,
    slug,
    description,
    visibility,
  });

  if (!updated) throw tagNotFound();

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "tag.update",
      target: { type: "tag", id: tagId },
      before: null,
      after: { id: tagId, title: updated.title, visibility: updated.visibility },
      reason: null,
      metadata: {},
    },
  );

  return { data: mapTagDetail(updated) };
}

export async function deleteTag(tx: TenantTx, ctx: ServiceCtx, tagId: string) {
  const deleted = await softDeleteTag({ tx, tenantId: ctx.tenantId, tagId });
  if (!deleted) throw tagNotFound();

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "tag.delete",
      target: { type: "tag", id: tagId },
      before: { id: tagId },
      after: null,
      reason: null,
      metadata: {},
    },
  );

  return { data: { id: tagId, deleted: true as const } };
}

export async function listLessonTags(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  options?: { studio?: boolean },
) {
  if (options?.studio) {
    await requireOwnedLesson(tx, ctx, lessonId);
  }

  const items = await listTagsForLesson({
    tx,
    tenantId: ctx.tenantId,
    lessonId,
    publicOnly: !options?.studio,
  });

  return {
    data: {
      items: items.map(mapTagSummary),
    },
  };
}

export async function replaceTagsOnLesson(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  input: ReplaceLessonTagsBody,
) {
  await requireOwnedLesson(tx, ctx, lessonId);

  const uniqueTagIds = [...new Set(input.tagIds)];
  const valid = await validateTagIdsExist({
    tx,
    tenantId: ctx.tenantId,
    tagIds: uniqueTagIds,
  });

  if (!valid) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "One or more tags were not found.",
    });
  }

  await replaceLessonTags({
    tx,
    tenantId: ctx.tenantId,
    lessonId,
    tagIds: uniqueTagIds,
  });

  const items = await listTagsForLesson({
    tx,
    tenantId: ctx.tenantId,
    lessonId,
  });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "lesson.tags.replace",
      target: { type: "lesson", id: lessonId },
      before: null,
      after: { tagIds: uniqueTagIds },
      reason: null,
      metadata: {},
    },
  );

  return {
    data: {
      items: items.map(mapTagSummary),
    },
  };
}

export async function createTagAndAttachToLesson(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  input: CreateTagBody,
) {
  await requireOwnedLesson(tx, ctx, lessonId);
  const created = await createTag(tx, ctx, input);

  await attachTagToLesson({
    tx,
    tenantId: ctx.tenantId,
    lessonId,
    tagId: created.data.id,
  });

  const items = await listTagsForLesson({
    tx,
    tenantId: ctx.tenantId,
    lessonId,
  });

  return {
    tag: created.data,
    lessonTags: {
      data: {
        items: items.map(mapTagSummary),
      },
    },
  };
}

export async function detachTagFromLessonForStudio(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  tagId: string,
) {
  await requireOwnedLesson(tx, ctx, lessonId);
  await detachTagFromLesson({
    tx,
    tenantId: ctx.tenantId,
    lessonId,
    tagId,
  });

  const items = await listTagsForLesson({
    tx,
    tenantId: ctx.tenantId,
    lessonId,
  });

  return {
    data: {
      items: items.map(mapTagSummary),
    },
  };
}

export async function listCourseTags(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  options?: { studio?: boolean },
) {
  if (options?.studio) {
    await requireOwnedCourse(tx, ctx, courseId);
  }

  const items = await listTagsForCourse({
    tx,
    tenantId: ctx.tenantId,
    courseId,
    publicOnly: !options?.studio,
  });

  return {
    data: {
      items: items.map(mapTagSummary),
    },
  };
}

export async function replaceTagsOnCourse(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  input: ReplaceCourseTagsBody,
) {
  await requireOwnedCourse(tx, ctx, courseId);

  const uniqueTagIds = [...new Set(input.tagIds)];
  const valid = await validateTagIdsExist({
    tx,
    tenantId: ctx.tenantId,
    tagIds: uniqueTagIds,
  });

  if (!valid) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "One or more tags were not found.",
    });
  }

  await replaceCourseTags({
    tx,
    tenantId: ctx.tenantId,
    courseId,
    tagIds: uniqueTagIds,
  });

  const items = await listTagsForCourse({
    tx,
    tenantId: ctx.tenantId,
    courseId,
  });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "course.tags.replace",
      target: { type: "course", id: courseId },
      before: null,
      after: { tagIds: uniqueTagIds },
      reason: null,
      metadata: {},
    },
  );

  return {
    data: {
      items: items.map(mapTagSummary),
    },
  };
}

export async function createTagAndAttachToCourse(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  input: CreateTagBody,
) {
  await requireOwnedCourse(tx, ctx, courseId);
  const created = await createTag(tx, ctx, input);

  await attachTagToCourse({
    tx,
    tenantId: ctx.tenantId,
    courseId,
    tagId: created.data.id,
  });

  const items = await listTagsForCourse({
    tx,
    tenantId: ctx.tenantId,
    courseId,
  });

  return {
    tag: created.data,
    courseTags: {
      data: {
        items: items.map(mapTagSummary),
      },
    },
  };
}

export async function detachTagFromCourseForStudio(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  tagId: string,
) {
  await requireOwnedCourse(tx, ctx, courseId);
  await detachTagFromCourse({
    tx,
    tenantId: ctx.tenantId,
    courseId,
    tagId,
  });

  const items = await listTagsForCourse({
    tx,
    tenantId: ctx.tenantId,
    courseId,
  });

  return {
    data: {
      items: items.map(mapTagSummary),
    },
  };
}

export { listTagsForLesson, listTagIdsForLessons, listTagsForCourse } from "./tags.repository";
export { mapTagSummary };
