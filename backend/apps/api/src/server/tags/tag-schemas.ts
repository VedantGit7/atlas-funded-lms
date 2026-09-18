import { z } from "zod";
import { mutationBodySchema } from "@atlas/membership/schemas/shared";

export const tagVisibilitySchema = z.enum(["public", "private", "classification"]);

/**
 * How many things carry this tag.
 *
 * Both join tables index `(tenant_id, tag_id)`, so the reverse lookup was
 * always cheap — nobody had written the query. Until now every surface that
 * wanted a blast radius had to say it could not know one, which is the worst
 * possible answer on a delete confirmation.
 */
export const tagUsageSchema = z.object({
  courses: z.number().int().min(0),
  lessons: z.number().int().min(0),
});

export const tagSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  visibility: tagVisibilitySchema,
  /**
   * Present only when the caller asked for it with `withUsage`.
   *
   * Optional rather than always-on because the lesson and course editors read
   * this same shape on every keystroke of their tag pickers, and neither of
   * them displays a count.
   */
  usage: tagUsageSchema.optional(),
});

export const tagDetailSchema = tagSummarySchema.extend({
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const tagListQuerySchema = z
  .object({
    visibility: tagVisibilitySchema.optional(),
    publicOnly: z.coerce.boolean().optional(),
    withUsage: z.coerce.boolean().optional(),
  })
  .strict();

export const createTagBodySchema = mutationBodySchema({
  title: z.string().trim().min(1).max(60),
  description: z.string().trim().max(255).optional(),
  visibility: tagVisibilitySchema.optional(),
});

export const updateTagBodySchema = mutationBodySchema({
  title: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(255).optional(),
  visibility: tagVisibilitySchema.optional(),
});

export const replaceLessonTagsBodySchema = mutationBodySchema({
  tagIds: z.array(z.uuid()).max(100),
});

export const replaceCourseTagsBodySchema = mutationBodySchema({
  tagIds: z.array(z.uuid()).max(100),
});

export const tagListResponseSchema = z.object({
  data: z.object({
    items: z.array(tagSummarySchema),
  }),
});

export const tagDetailResponseSchema = z.object({
  data: tagDetailSchema,
});

export const lessonTagsResponseSchema = z.object({
  data: z.object({
    items: z.array(tagSummarySchema),
  }),
});

export const courseTagsResponseSchema = z.object({
  data: z.object({
    items: z.array(tagSummarySchema),
  }),
});

export const replaceLessonTagsResponseSchema = lessonTagsResponseSchema;

export const replaceCourseTagsResponseSchema = courseTagsResponseSchema;

export type TagVisibility = z.output<typeof tagVisibilitySchema>;
export type TagSummary = z.output<typeof tagSummarySchema>;
export type CreateTagBody = z.output<typeof createTagBodySchema>;
export type UpdateTagBody = z.output<typeof updateTagBodySchema>;
export type ReplaceLessonTagsBody = z.output<typeof replaceLessonTagsBodySchema>;
export type ReplaceCourseTagsBody = z.output<typeof replaceCourseTagsBodySchema>;
export type TagListQuery = z.output<typeof tagListQuerySchema>;

/** How many attachments of each kind the usage endpoint names individually. */
export const TAG_USAGE_SAMPLE_LIMIT = 25;

/** The most tags one bulk command may touch. */
export const TAG_BULK_LIMIT = 100;

export const tagUsageCourseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  status: z.string(),
});

export const tagUsageLessonSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  courseId: z.uuid(),
  courseTitle: z.string(),
});

/**
 * Where a tag is actually attached.
 *
 * `counts` is the full total; the two arrays are capped at
 * `TAG_USAGE_SAMPLE_LIMIT` each and `truncated` says so, because an admin
 * deciding whether to delete needs the number to be exact even when the list
 * is only a sample.
 */
export const tagUsageResponseSchema = z.object({
  data: z.object({
    tagId: z.uuid(),
    counts: tagUsageSchema,
    courses: z.array(tagUsageCourseSchema),
    lessons: z.array(tagUsageLessonSchema),
    truncated: z.boolean(),
  }),
});

export const bulkTagActionBodySchema = mutationBodySchema({
  tagIds: z.array(z.uuid()).min(1).max(TAG_BULK_LIMIT),
  action: z.enum(["set_visibility", "delete"]),
  visibility: tagVisibilitySchema.optional(),
}).superRefine((value, ctx) => {
  if (value.action === "set_visibility" && value.visibility === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["visibility"],
      message: "A visibility is required when setting visibility.",
    });
  }
});

/**
 * Ids that no longer resolve come back as `missingIds` rather than failing the
 * batch: a tag deleted by a colleague while the page sat open should not cost
 * the operator the rest of their selection.
 */
export const bulkTagActionResponseSchema = z.object({
  data: z.object({
    updatedIds: z.array(z.uuid()),
    missingIds: z.array(z.uuid()),
  }),
});

/** The most tags one merge may fold away at once. */
export const TAG_MERGE_SOURCE_LIMIT = 25;

/**
 * Fold one or more tags into a survivor.
 *
 * Plural because a duplicate cluster is rarely a pair — a vocabulary that has
 * drifted usually carries "Beginner", "beginners" and "Beginner's guide"
 * together. Folding them one call at a time would leave a half-merged
 * vocabulary behind the first failure, which is precisely the state this screen
 * exists to clear up.
 */
export const mergeTagsBodySchema = mutationBodySchema({
  sourceTagIds: z.array(z.uuid()).min(1).max(TAG_MERGE_SOURCE_LIMIT),
  targetTagId: z.uuid(),
}).superRefine((value, ctx) => {
  if (value.sourceTagIds.includes(value.targetTagId)) {
    ctx.addIssue({
      code: "custom",
      path: ["sourceTagIds"],
      message: "A tag cannot be merged into itself.",
    });
  }
});

export const mergeTagsResponseSchema = z.object({
  data: z.object({
    sourceTagIds: z.array(z.uuid()),
    targetTagId: z.uuid(),
    movedCourses: z.number().int().min(0),
    movedLessons: z.number().int().min(0),
    /** Attachments dropped because the course or lesson already had the target. */
    alreadyTagged: z.number().int().min(0),
  }),
});

export type TagUsage = z.output<typeof tagUsageSchema>;
export type BulkTagActionBody = z.output<typeof bulkTagActionBodySchema>;
export type MergeTagsBody = z.output<typeof mergeTagsBodySchema>;
