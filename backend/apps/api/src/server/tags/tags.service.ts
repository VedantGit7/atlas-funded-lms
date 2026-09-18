import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { findCourseAuthProjection } from "../courses/courses.repository";
import { courseNotFound } from "../courses/courses.errors";
import { findLessonWithModuleAndCourse } from "../lessons/lessons.repository";
import { lessonNotFound } from "../lessons/lessons.errors";
import type {
  BulkTagActionBody,
  CreateTagBody,
  MergeTagsBody,
  ReplaceCourseTagsBody,
  ReplaceLessonTagsBody,
  TagListQuery,
  TagSummary,
  UpdateTagBody,
} from "./tag-schemas";
import { TAG_USAGE_SAMPLE_LIMIT } from "./tag-schemas";
import { tagCannotMergeIntoItself, tagNotFound, tagSlugTaken } from "./tags.errors";
import {
  attachTagToCourse,
  attachTagToLesson,
  countTagUsage,
  detachTagFromCourse,
  detachTagFromLesson,
  findExistingTagIds,
  findTagById,
  findTagBySlug,
  listCoursesWithTag,
  listLessonsWithTag,
  repointTagAttachments,
  setTagVisibilityMany,
  softDeleteTagsMany,
  fromApiTagVisibility,
  insertTag,
  listTags,
  listTagsForCourse,
  listTagsForLesson,
  replaceCourseTags,
  replaceLessonTags,
  slugifyTagTitle,
  softDeleteTag,
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

  const summaries = items.map(mapTagSummary);

  // Two extra aggregates for the whole page, not one per row: the admin screen
  // renders every tag at once, so a per-tag count would be an N+1 over a list
  // that is deliberately unpaginated.
  if (query?.withUsage) {
    const usage = await countTagUsage({
      tx,
      tenantId: ctx.tenantId,
      tagIds: summaries.map((tag) => tag.id),
    });

    return {
      data: {
        items: summaries.map((tag) => ({
          ...tag,
          usage: usage.get(tag.id) ?? { courses: 0, lessons: 0 },
        })),
      },
    };
  }

  return {
    data: {
      items: summaries,
    },
  };
}

/**
 * Where a tag is attached.
 *
 * The console used to state plainly that it could not answer this, which was
 * true of the API and not of the database: both join tables are indexed on
 * `(tenant_id, tag_id)`. The counts are exact; the two lists are samples, and
 * `truncated` says which.
 */
export async function getTagUsage(tx: TenantTx, ctx: ServiceCtx, tagId: string) {
  const tag = await findTagById({ tx, tenantId: ctx.tenantId, tagId });
  if (!tag) throw tagNotFound();

  const counts = await countTagUsage({ tx, tenantId: ctx.tenantId, tagIds: [tagId] });
  const totals = counts.get(tagId) ?? { courses: 0, lessons: 0 };

  const [courses, lessons] = await Promise.all([
    listCoursesWithTag({ tx, tenantId: ctx.tenantId, tagId, limit: TAG_USAGE_SAMPLE_LIMIT }),
    listLessonsWithTag({ tx, tenantId: ctx.tenantId, tagId, limit: TAG_USAGE_SAMPLE_LIMIT }),
  ]);

  return {
    data: {
      tagId,
      counts: totals,
      courses,
      lessons,
      truncated: courses.length < totals.courses || lessons.length < totals.lessons,
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

  const clash = await findTagBySlug({ tx, tenantId: ctx.tenantId, slug });
  if (clash) {
    throw tagSlugTaken(clash.title, clash.slug);
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

  // Create checked this and rename did not, so renaming one tag onto another's
  // slug reached the unique index on (tenant_id, slug) and came back as a raw
  // 23505 — a 500 for what is an ordinary "that name is taken". Excluding this
  // tag's own id is what stops it colliding with itself on every save.
  if (slug !== existing.slug) {
    const clash = await findTagBySlug({
      tx,
      tenantId: ctx.tenantId,
      slug,
      excludeTagId: tagId,
    });
    if (clash) {
      throw tagSlugTaken(clash.title, clash.slug);
    }
  }

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

/**
 * Re-scope or remove a selection of tags in one transaction.
 *
 * Batched for the same reason the roster actions are: the screen acts on a
 * selection, so twenty-five tags move together or not at all. Ids that no
 * longer resolve come back as `missingIds` rather than failing the batch — a
 * tag deleted by a colleague while the page sat open should not cost the
 * operator the rest of their selection.
 *
 * Each changed tag gets the same audit action a single-tag edit would write, so
 * an existing query for `tag.delete` does not quietly miss everything done in
 * bulk; `metadata.bulk` is what distinguishes them.
 */
export async function bulkTagAction(tx: TenantTx, ctx: ServiceCtx, input: BulkTagActionBody) {
  const requestedIds = [...new Set(input.tagIds)];
  const existingIds = await findExistingTagIds({
    tx,
    tenantId: ctx.tenantId,
    tagIds: requestedIds,
  });

  const updatedIds =
    input.action === "delete"
      ? await softDeleteTagsMany({ tx, tenantId: ctx.tenantId, tagIds: existingIds })
      : await setTagVisibilityMany({
          tx,
          tenantId: ctx.tenantId,
          tagIds: existingIds,
          visibility: fromApiTagVisibility(input.visibility ?? "public"),
        });

  const changed = new Set(updatedIds);
  const missingIds = requestedIds.filter((id) => !changed.has(id));

  for (const tagId of updatedIds) {
    await auditWriter.write(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        platformPrincipalId: null,
        requestId: ctx.requestId,
      },
      {
        action: input.action === "delete" ? "tag.delete" : "tag.update",
        target: { type: "tag", id: tagId },
        before: null,
        after:
          input.action === "delete" ? null : { id: tagId, visibility: input.visibility ?? null },
        reason: null,
        metadata: { bulk: true },
      },
    );
  }

  return { data: { updatedIds, missingIds } };
}

/**
 * Fold one tag into another, keeping every attachment.
 *
 * The list screen flags near-duplicates — "Beginner" beside "beginners" is the
 * exact mess this module exists for — and flagging them with no way to resolve
 * them is a dead end. Merging re-points the source's course and lesson
 * attachments onto the target and then soft-deletes the source, so no course
 * silently loses a tag in the process.
 */
export async function mergeTags(tx: TenantTx, ctx: ServiceCtx, input: MergeTagsBody) {
  const target = await findTagById({ tx, tenantId: ctx.tenantId, tagId: input.targetTagId });
  if (!target) throw tagNotFound();

  const sourceIds = [...new Set(input.sourceTagIds)];
  if (sourceIds.includes(target.id)) {
    throw tagCannotMergeIntoItself();
  }

  // Resolve every source before moving anything. A merge that folded two tags
  // and then discovered the third was already gone would leave the vocabulary
  // in exactly the half-tidied state this screen exists to clear — and the
  // transaction rolls back, so the operator sees one clean failure.
  const sources = [];
  for (const sourceTagId of sourceIds) {
    const source = await findTagById({ tx, tenantId: ctx.tenantId, tagId: sourceTagId });
    if (!source) throw tagNotFound();
    sources.push(source);
  }

  const totals = { movedCourses: 0, movedLessons: 0, alreadyTagged: 0 };

  for (const source of sources) {
    const moved = await repointTagAttachments({
      tx,
      tenantId: ctx.tenantId,
      sourceTagId: source.id,
      targetTagId: target.id,
    });

    const deleted = await softDeleteTag({ tx, tenantId: ctx.tenantId, tagId: source.id });
    if (!deleted) throw tagNotFound();

    totals.movedCourses += moved.movedCourses;
    totals.movedLessons += moved.movedLessons;
    totals.alreadyTagged += moved.alreadyTagged;

    // One entry per folded tag rather than one per merge: "which tags became
    // this one" is the question the history has to answer, and a single
    // aggregate entry cannot.
    await auditWriter.write(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        platformPrincipalId: null,
        requestId: ctx.requestId,
      },
      {
        action: "tag.merge",
        target: { type: "tag", id: target.id },
        before: { id: source.id, title: source.title, slug: source.slug },
        after: { id: target.id, title: target.title, slug: target.slug },
        reason: null,
        metadata: {
          movedCourses: moved.movedCourses,
          movedLessons: moved.movedLessons,
          alreadyTagged: moved.alreadyTagged,
        },
      },
    );
  }

  return {
    data: {
      sourceTagIds: sources.map((source) => source.id),
      targetTagId: target.id,
      ...totals,
    },
  };
}

export { listTagsForLesson, listTagIdsForLessons, listTagsForCourse } from "./tags.repository";
export { mapTagSummary };
