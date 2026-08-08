import { z } from "zod";
import { pageInfoSchema } from "@atlas/membership/schemas/shared";

export const courseReviewIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const submitReviewBodySchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

export const courseReviewsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
    cursor: z.string().optional(),
  })
  .strict();

export const courseReviewItemSchema = z.object({
  id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  authorName: z.string().nullable(),
  mine: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const courseReviewAggregateSchema = z.object({
  average: z.number().min(0).max(5).nullable(),
  count: z.number().int().nonnegative(),
});

export const courseReviewsResponseSchema = z.object({
  data: z.object({
    items: z.array(courseReviewItemSchema),
    aggregate: courseReviewAggregateSchema,
    myReview: courseReviewItemSchema.nullable(),
    pageInfo: pageInfoSchema,
  }),
});

export const submitReviewResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    created: z.boolean(),
  }),
});

export type SubmitReviewBody = z.output<typeof submitReviewBodySchema>;
export type CourseReviewsQuery = z.output<typeof courseReviewsQuerySchema>;
