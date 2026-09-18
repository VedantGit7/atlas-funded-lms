// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { z } from "zod";
import { mutationBodySchema, pageInfoSchema } from "@atlas/membership/schemas/shared";

export const publishStatusStudioSchema = z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]);

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
  status: publishStatusStudioSchema,
  coverKey: z.string().nullable().optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
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
});

export type CreateModuleBody = z.output<typeof createModuleBodySchema>;

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
