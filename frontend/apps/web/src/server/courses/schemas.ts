// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

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
    view: z.literal("studio").optional(),
    status: z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status != null && value.view !== "studio") {
      ctx.addIssue({
        code: "custom",
        message: "status filter requires view=studio",
        path: ["status"],
      });
    }
  });

export type CourseListQuery = z.output<typeof courseListQuerySchema>;

export const courseIdParamsSchema = z.object({
  id: z.uuid(),
});

export const courseListItemSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: publishStatusLearnerSchema,
  coverKey: z.string().nullable().optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
  enrollmentStatus: z.enum(["enrolled", "not_enrolled"]).nullable(),
  updatedAt: z.iso.datetime(),
});

export const courseListResponseSchema = z.object({
  data: z.object({
    items: z.array(courseListItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const courseDetailSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: publishStatusLearnerSchema,
  coverKey: z.string().nullable().optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
  enrollmentStatus: z.enum(["enrolled", "not_enrolled"]),
  enrolledAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const courseDetailResponseSchema = z.object({
  data: courseDetailSchema,
});

export const courseModuleOutlineItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  position: z.number().int(),
  lessonCount: z.number().int().nonnegative(),
});

export const courseModulesResponseSchema = z.object({
  data: z.object({
    items: z.array(courseModuleOutlineItemSchema),
  }),
});

export {
  studioCourseListQuerySchema,
  createCourseBodySchema,
  updateCourseBodySchema,
  createModuleBodySchema,
  updateModuleBodySchema,
  publishCourseBodySchema,
  studioCourseListResponseSchema,
  studioCourseDetailResponseSchema,
  createCourseResponseSchema,
  studioCourseModulesResponseSchema,
  studioModuleResponseSchema,
  publishCourseResponseSchema,
  archiveCourseResponseSchema,
  courseDetailQuerySchema,
} from "./course-authoring-schemas";
