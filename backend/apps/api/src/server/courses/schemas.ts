import { z } from "zod";
import { pageInfoSchema } from "@atlas/membership/schemas/shared";
export const publishStatusLearnerSchema = z.literal("PUBLISHED");

export const courseAccessTierSchema = z.enum(["FREE", "PAID"]);

export const coursePricingFields = {
  accessTier: courseAccessTierSchema,
  priceCents: z.number().int().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
  locked: z.boolean(),
};

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

export const courseLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);

export const courseInstructorSchema = z.object({
  name: z.string().nullable(),
  avatarKey: z.string().nullable(),
});

/**
 * Catalog presentation fields. All are derived from real data (lesson
 * durations, enrollments, member profiles, lesson progress) or the course's
 * metadata JSON, and default to null/0 when the underlying data is absent so
 * the catalog degrades gracefully. `rating*` are populated by the reviews
 * subsystem and stay null until a course has reviews.
 */
export const courseCatalogFields = {
  level: courseLevelSchema.nullable(),
  category: z.string().nullable(),
  featured: z.boolean(),
  trending: z.boolean(),
  compareAtPriceCents: z.number().int().nonnegative().nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  studentCount: z.number().int().nonnegative(),
  instructor: courseInstructorSchema.nullable(),
  progressPct: z.number().int().min(0).max(100).nullable(),
  ratingAverage: z.number().min(0).max(5).nullable(),
  ratingCount: z.number().int().nonnegative(),
};

export const courseListItemSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: publishStatusLearnerSchema,
  coverKey: z.string().nullable().optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
  ...coursePricingFields,
  ...courseCatalogFields,
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
  ...coursePricingFields,
  enrollmentStatus: z.enum(["enrolled", "not_enrolled"]),
  enrolledAt: z.iso.datetime().nullable(),
  resumeLessonId: z.uuid().nullable().optional(),
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
  contentKind: z.enum(["standard", "scorm"]),
  scormLaunchReady: z.boolean(),
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
  moduleScormPackageUploadBodySchema,
  moduleScormPackageConfirmBodySchema,
  moduleScormPackageBlobBodySchema,
  moduleScormProgressBodySchema,
  moduleScormLaunchResponseSchema,
  moduleScormProgressResponseSchema,
  publishCourseBodySchema,
  studioCourseListResponseSchema,
  studioCourseDetailResponseSchema,
  createCourseResponseSchema,
  studioCourseModulesResponseSchema,
  studioModuleResponseSchema,
  publishCourseResponseSchema,
  archiveCourseResponseSchema,
  courseDetailQuerySchema,
  courseManageEnrollmentBodySchema,
  courseManageEnrollmentResponseSchema,
} from "./course-authoring-schemas";
