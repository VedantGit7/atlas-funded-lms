import { z } from "zod";
import { mutationBodySchema, pageInfoSchema } from "../membership/schemas/shared";

export const publishStatusStudioSchema = z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]);

export const courseAccessTierSchema = z.enum(["FREE", "PAID"]);

const coursePricingInputFields = {
  accessTier: courseAccessTierSchema.optional(),
  priceCents: z.coerce.number().int().min(0).max(100_000_000).nullable().optional(),
  currency: z.string().trim().length(3).optional(),
};

export const studioCourseListQuerySchema = z
  .object({
    view: z.literal("studio"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().optional(),
    q: z.string().trim().min(1).max(200).optional(),
    status: publishStatusStudioSchema.optional(),
    sort: z.enum(["updated_desc", "title_asc", "title_desc"]).default("updated_desc"),
  })
  .strict();

export type StudioCourseListQuery = z.output<typeof studioCourseListQuerySchema>;

export const createCourseBodySchema = mutationBodySchema({
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens.")
    .optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  shortDescription: z.string().trim().max(500).optional(),
  coverKey: z.string().trim().min(1).max(500).optional(),
  thumbnailAssetId: z.uuid().optional(),
  estimatedDuration: z.coerce.number().int().min(0).max(100000).optional(),
  level: z.string().trim().min(1).max(100).optional(),
  stage: z.string().trim().min(1).max(100).optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
  ...coursePricingInputFields,
});

export type CreateCourseBody = z.output<typeof createCourseBodySchema>;

export const updateCourseBodySchema = mutationBodySchema({
  title: z.string().trim().min(1).max(200).optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens.")
    .optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  shortDescription: z.string().trim().max(500).optional(),
  coverKey: z.string().trim().min(1).max(500).optional(),
  thumbnailAssetId: z.uuid().optional(),
  estimatedDuration: z.coerce.number().int().min(0).max(100000).optional(),
  level: z.string().trim().min(1).max(100).optional(),
  stage: z.string().trim().min(1).max(100).optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
  ...coursePricingInputFields,
  status: z.never().optional(),
  userId: z.never().optional(),
  memberId: z.never().optional(),
  membershipId: z.never().optional(),
  createdBy: z.never().optional(),
  created_by_membership_id: z.never().optional(),
});

export type UpdateCourseBody = z.output<typeof updateCourseBodySchema>;

export const studioCourseListItemSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: publishStatusStudioSchema,
  coverKey: z.string().nullable().optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
  accessTier: courseAccessTierSchema.optional(),
  priceCents: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  updatedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const studioCourseListResponseSchema = z.object({
  data: z.object({
    items: z.array(studioCourseListItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const studioCourseDetailSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  shortDescription: z.string().nullable().optional(),
  status: publishStatusStudioSchema,
  coverKey: z.string().nullable().optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
  accessTier: courseAccessTierSchema,
  priceCents: z.number().int().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
  updatedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const studioCourseDetailResponseSchema = z.object({
  data: studioCourseDetailSchema,
});

export const createCourseResponseSchema = z.object({
  data: studioCourseDetailSchema,
});

export const createModuleBodySchema = mutationBodySchema({
  title: z.string().trim().min(1).max(200),
  position: z.coerce.number().int().min(1).max(500).optional(),
  contentKind: z.enum(["standard", "scorm"]).optional(),
});

export type CreateModuleBody = z.output<typeof createModuleBodySchema>;

export const courseModuleContentKindSchema = z.enum(["standard", "scorm"]);

export const moduleScormPackageUploadBodySchema = mutationBodySchema({
  fileName: z.string().trim().min(1).max(240),
  contentType: z.string().trim().min(1).max(180),
  sizeBytes: z.number().int().min(1),
  checksumSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable()
    .optional(),
});

export type ModuleScormPackageUploadBody = z.output<typeof moduleScormPackageUploadBodySchema>;

export const moduleScormPackageConfirmBodySchema = mutationBodySchema({
  assetReferenceId: z.uuid(),
});

export type ModuleScormPackageConfirmBody = z.output<typeof moduleScormPackageConfirmBodySchema>;

export const moduleScormPackageBlobBodySchema = mutationBodySchema({
  assetReferenceId: z.uuid(),
  contentBase64: z.string().min(1),
});

export type ModuleScormPackageBlobBody = z.output<typeof moduleScormPackageBlobBodySchema>;

export const moduleScormProgressBodySchema = mutationBodySchema({
  cmi: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  completed: z.boolean().optional(),
});

export type ModuleScormProgressBody = z.output<typeof moduleScormProgressBodySchema>;

export const moduleScormLaunchResponseSchema = z.object({
  data: z.object({
    moduleId: z.uuid(),
    courseId: z.uuid(),
    title: z.string(),
    scormVersion: z.enum(["1.2", "2004"]),
    launchPath: z.string(),
    contentUrl: z.string(),
    progress: z.object({
      status: z.enum(["not_started", "in_progress", "completed"]),
      progressPct: z.number().int().min(0).max(100),
      completedAt: z.iso.datetime().nullable(),
    }),
  }),
});

export const moduleScormProgressResponseSchema = z.object({
  data: z.object({
    status: z.enum(["not_started", "in_progress", "completed"]),
    progressPct: z.number().int().min(0).max(100),
    cmi: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    completedAt: z.iso.datetime().nullable(),
    lastSeenAt: z.iso.datetime().nullable(),
  }),
});

export const updateModuleBodySchema = mutationBodySchema({
  title: z.string().trim().min(1).max(200).optional(),
  position: z.coerce.number().int().min(1).max(500).optional(),
});

export type UpdateModuleBody = z.output<typeof updateModuleBodySchema>;

export const studioModuleOutlineItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  position: z.number().int(),
  status: publishStatusStudioSchema,
  lessonCount: z.number().int().nonnegative(),
  contentKind: courseModuleContentKindSchema,
  scormPackageReady: z.boolean(),
});

export const studioCourseModulesResponseSchema = z.object({
  data: z.object({
    items: z.array(studioModuleOutlineItemSchema),
  }),
});

export const studioModuleResponseSchema = z.object({
  data: studioModuleOutlineItemSchema,
});

export const publishCourseBodySchema = mutationBodySchema({
  reason: z.string().trim().min(1).max(500).optional(),
});

export type PublishCourseBody = z.output<typeof publishCourseBodySchema>;

export const publishCourseResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    status: publishStatusStudioSchema,
    submittedAt: z.iso.datetime(),
    workflowTransitionId: z.uuid(),
  }),
});

export const courseEnrollmentPaymentMethodSchema = z.enum(["manual", "complimentary", "offline"]);

export const courseManageEnrollmentBodySchema = mutationBodySchema({
  membershipId: z.uuid(),
  purchasedCertificate: z.boolean().optional(),
  paymentMethod: courseEnrollmentPaymentMethodSchema.optional(),
  userId: z.never().optional(),
  memberId: z.never().optional(),
  status: z.never().optional(),
});

export type CourseManageEnrollmentBody = z.output<typeof courseManageEnrollmentBodySchema>;

export const courseManageEnrollmentResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    courseId: z.uuid(),
    membershipId: z.uuid(),
    status: z.literal("active"),
    enrolledAt: z.iso.datetime(),
    created: z.boolean(),
  }),
});

export const archiveCourseResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    status: z.literal("ARCHIVED"),
    archivedAt: z.iso.datetime(),
  }),
});

export const courseDetailQuerySchema = z
  .object({
    view: z.literal("studio").optional(),
  })
  .strict();

export type CourseDetailQuery = z.output<typeof courseDetailQuerySchema>;
