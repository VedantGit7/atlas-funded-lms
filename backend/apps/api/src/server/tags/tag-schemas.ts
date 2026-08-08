import { z } from "zod";
import { mutationBodySchema } from "@atlas/membership/schemas/shared";

export const tagVisibilitySchema = z.enum(["public", "private", "classification"]);

export const tagSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  visibility: tagVisibilitySchema,
});

export const tagDetailSchema = tagSummarySchema.extend({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const tagListQuerySchema = z
  .object({
    visibility: tagVisibilitySchema.optional(),
    publicOnly: z.coerce.boolean().optional(),
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
  tagIds: z.array(z.string().uuid()).max(100),
});

export const replaceCourseTagsBodySchema = mutationBodySchema({
  tagIds: z.array(z.string().uuid()).max(100),
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
