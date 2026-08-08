import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { getCourseReviews, submitCourseReview } from "../../../../../../server/reviews/reviews.service";
import {
  courseReviewIdParamsSchema,
  courseReviewsQuerySchema,
  courseReviewsResponseSchema,
  submitReviewBodySchema,
  submitReviewResponseSchema,
} from "../../../../../../server/reviews/schemas";
import { getReviewsRouteMetadata, postReviewRouteMetadata } from "./route.metadata";

type CourseReviewsQuery = z.output<typeof courseReviewsQuerySchema>;
type CourseReviewsResponse = z.output<typeof courseReviewsResponseSchema>;
type SubmitReviewBody = z.output<typeof submitReviewBodySchema>;
type SubmitReviewResponse = z.output<typeof submitReviewResponseSchema>;

export const GET = createTenantRoute<
  CourseReviewsQuery,
  CourseReviewsResponse,
  typeof courseReviewIdParamsSchema
>({
  metadata: getReviewsRouteMetadata,
  params: courseReviewIdParamsSchema,
  input: courseReviewsQuerySchema,
  output: courseReviewsResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await getCourseReviews(tx, ctx, courseId, input);
  },
});

export const POST = createTenantRoute<
  SubmitReviewBody,
  SubmitReviewResponse,
  typeof courseReviewIdParamsSchema
>({
  metadata: postReviewRouteMetadata,
  params: courseReviewIdParamsSchema,
  body: submitReviewBodySchema,
  output: submitReviewResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await submitCourseReview(tx, ctx, courseId, input);
  },
});
