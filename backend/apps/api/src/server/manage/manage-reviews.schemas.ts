import { z } from "zod";

export const REVIEW_MODERATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export const manageReviewsQuerySchema = z
  .object({
    q: z.string().optional(),
    status: z.enum(REVIEW_MODERATION_STATUSES).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const manageReviewItemSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  courseTitle: z.string(),
  membershipId: z.string().uuid(),
  authorName: z.string().nullable(),
  authorEmail: z.string().nullable(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  status: z.enum(REVIEW_MODERATION_STATUSES),
  adminNote: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const manageReviewsListResponseSchema = z.object({
  data: z.object({ items: z.array(manageReviewItemSchema) }),
});

export const createManageReviewBodySchema = z
  .object({
    courseId: z.string().uuid(),
    membershipId: z.string().uuid().optional(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(2000).optional(),
    status: z.enum(REVIEW_MODERATION_STATUSES).default("APPROVED"),
  })
  .strict();

export const updateManageReviewBodySchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(REVIEW_MODERATION_STATUSES).optional(),
    adminNote: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const manageReviewResponseSchema = z.object({ data: manageReviewItemSchema });
export const deleteManageReviewResponseSchema = z.object({
  data: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
});
