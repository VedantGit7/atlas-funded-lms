import { z } from "zod";
import { mutationBodySchema } from "@atlas/membership/schemas/shared";
import { publishStatusStudioSchema } from "../courses/course-authoring-schemas";

export const videoProviderSchema = z.enum(["youtube", "vimeo", "bunny"]);

const forbiddenIdentityFields = {
  userId: z.never().optional(),
  memberId: z.never().optional(),
  membershipId: z.never().optional(),
  enrollmentId: z.never().optional(),
  createdBy: z.never().optional(),
  courseId: z.never().optional(),
  moduleId: z.never().optional(),
  status: z.never().optional(),
};

const safeUrlSchema = z
  .url()
  .refine((value) => !value.trim().toLowerCase().startsWith("javascript:"), {
    message: "javascript: URLs are not allowed.",
  });

const lessonContentSchema = z
  .union([z.string().trim().max(500_000), z.record(z.string(), z.unknown())])
  .optional();

function rejectUnsafeHtml(value: string): boolean {
  return !/<script[\s>]/i.test(value);
}

export const lessonDetailQuerySchema = z
  .object({
    view: z.literal("studio").optional(),
  })
  .strict();

export type LessonDetailQuery = z.output<typeof lessonDetailQuerySchema>;

export const createLessonBodySchema = mutationBodySchema({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  lessonType: z.enum(["text", "video", "mixed"]).optional(),
  content: lessonContentSchema,
  videoProvider: videoProviderSchema.optional(),
  videoUrl: safeUrlSchema.optional(),
  durationSeconds: z.coerce.number().int().min(0).max(86400).optional(),
  position: z.coerce.number().int().min(1).max(500).optional(),
  isPreview: z.boolean().optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens.")
    .optional(),
  ...forbiddenIdentityFields,
});

export type CreateLessonBody = z.output<typeof createLessonBodySchema>;

export const updateLessonBodySchema = mutationBodySchema({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  lessonType: z.enum(["text", "video", "mixed"]).optional(),
  content: lessonContentSchema,
  videoProvider: videoProviderSchema.optional(),
  videoUrl: safeUrlSchema.optional(),
  durationSeconds: z.coerce.number().int().min(0).max(86400).optional(),
  position: z.coerce.number().int().min(1).max(500).optional(),
  isPreview: z.boolean().optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens.")
    .optional(),
  ...forbiddenIdentityFields,
}).superRefine((value, ctx) => {
  if (typeof value.content === "string" && !rejectUnsafeHtml(value.content)) {
    ctx.addIssue({
      code: "custom",
      message: "Content contains unsafe HTML.",
      path: ["content"],
    });
  }
});

export type UpdateLessonBody = z.output<typeof updateLessonBodySchema>;

export const learnerLessonOutlineItemSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  position: z.number().int(),
  durationSeconds: z.number().int().nullable().optional(),
});

export const studioLessonOutlineItemSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  position: z.number().int(),
  status: publishStatusStudioSchema,
  durationSeconds: z.number().int().nullable().optional(),
});

export const learnerLessonsResponseSchema = z.object({
  data: z.object({
    items: z.array(learnerLessonOutlineItemSchema),
  }),
});

export const studioLessonsResponseSchema = z.object({
  data: z.object({
    items: z.array(studioLessonOutlineItemSchema),
  }),
});

export const studioLessonResponseSchema = z.object({
  data: studioLessonOutlineItemSchema,
});

export const lessonProgressStateSchema = z.object({
  status: z.enum(["not_started", "in_progress", "completed"]),
  progressPct: z.number().int().min(0).max(100),
  positionSeconds: z.number().int().min(0).nullable(),
  completedAt: z.iso.datetime().nullable(),
  lastSeenAt: z.iso.datetime().nullable(),
});

export const learnerLessonDetailSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  moduleId: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  lessonType: z.string().nullable().optional(),
  content: z.unknown().nullable().optional(),
  videoProvider: videoProviderSchema.nullable().optional(),
  videoUrl: z.url().nullable().optional(),
  durationSeconds: z.number().int().nullable().optional(),
  position: z.number().int(),
  progress: lessonProgressStateSchema.nullable().optional(),
  navigation: z.object({
    previousLessonId: z.uuid().nullable(),
    nextLessonId: z.uuid().nullable(),
  }),
});

export const studioLessonDetailSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  moduleId: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  lessonType: z.string().nullable().optional(),
  content: z.unknown().nullable().optional(),
  videoProvider: videoProviderSchema.nullable().optional(),
  videoUrl: z.url().nullable().optional(),
  durationSeconds: z.number().int().nullable().optional(),
  position: z.number().int(),
  status: publishStatusStudioSchema,
  isPreview: z.boolean().optional(),
});

export const learnerLessonDetailResponseSchema = z.object({
  data: learnerLessonDetailSchema,
});

export const studioLessonDetailResponseSchema = z.object({
  data: studioLessonDetailSchema,
});

export const deleteLessonResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    deleted: z.literal(true),
  }),
});

export const createLessonAssetBodySchema = mutationBodySchema({
  assetType: z.string().trim().min(1).max(80),
  provider: z.string().trim().min(1).max(80),
  storageReferenceId: z.uuid().optional(),
  objectKeyOrUrl: z.string().trim().min(1).max(2000).optional(),
  displayOrder: z.coerce.number().int().min(0).max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  ...forbiddenIdentityFields,
});

export type CreateLessonAssetBody = z.output<typeof createLessonAssetBodySchema>;

export const deleteLessonAssetQuerySchema = z
  .object({
    assetId: z.uuid(),
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .strict();

export type DeleteLessonAssetQuery = z.output<typeof deleteLessonAssetQuerySchema>;

export const lessonAssetItemSchema = z.object({
  id: z.uuid(),
  assetType: z.string(),
  provider: z.string(),
  fileName: z.string().nullable().optional(),
  contentType: z.string().nullable().optional(),
  displayOrder: z.number().int().nullable().optional(),
  downloadUrl: z.url().nullable().optional(),
  downloadExpiresAt: z.iso.datetime().nullable().optional(),
  externalUrl: z.url().nullable().optional(),
});

export const lessonAssetsResponseSchema = z.object({
  data: z.object({
    items: z.array(lessonAssetItemSchema),
  }),
});

export const deleteLessonAssetResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    deleted: z.literal(true),
  }),
});

export const lessonProgressBodySchema = mutationBodySchema({
  positionSeconds: z.coerce.number().int().min(0).max(86400).optional(),
  completed: z.boolean().optional(),
  ...forbiddenIdentityFields,
});

export type LessonProgressBody = z.output<typeof lessonProgressBodySchema>;

export const lessonProgressResponseSchema = z.object({
  data: lessonProgressStateSchema,
});
