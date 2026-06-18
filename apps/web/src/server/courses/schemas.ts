import { z } from "zod";
import { pageInfoSchema } from "@atlas/membership/schemas/shared";

export const publishStatusLearnerSchema = z.literal("PUBLISHED");

export const courseListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().optional(),
    q: z.string().trim().min(1).max(200).optional(),
    stage: z.string().trim().min(1).max(100).optional(),
    dimension: z.string().trim().min(1).max(100).optional(),
    persona: z.string().trim().min(1).max(100).optional(),
    certificate: z.enum(["true", "false"]).optional(),
    sort: z.enum(["updated_desc", "title_asc", "title_desc"]).default("updated_desc"),
  })
  .strict();

export type CourseListQuery = z.output<typeof courseListQuerySchema>;

export const courseIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const courseListItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: publishStatusLearnerSchema,
  coverKey: z.string().nullable().optional(),
  tags: z.record(z.unknown()).optional(),
  enrollmentStatus: z.enum(["enrolled", "not_enrolled"]).nullable(),
  updatedAt: z.string().datetime(),
});

export const courseListResponseSchema = z.object({
  data: z.object({
    items: z.array(courseListItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const courseDetailSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: publishStatusLearnerSchema,
  coverKey: z.string().nullable().optional(),
  tags: z.record(z.unknown()).optional(),
  enrollmentStatus: z.enum(["enrolled", "not_enrolled"]),
  enrolledAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const courseDetailResponseSchema = z.object({
  data: courseDetailSchema,
});

export const courseModuleOutlineItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  position: z.number().int(),
  lessonCount: z.number().int().nonnegative(),
});

export const courseModulesResponseSchema = z.object({
  data: z.object({
    items: z.array(courseModuleOutlineItemSchema),
  }),
});
