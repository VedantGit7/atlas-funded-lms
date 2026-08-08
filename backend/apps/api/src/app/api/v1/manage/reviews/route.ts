import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createManageReviewBodySchema,
  manageReviewResponseSchema,
  manageReviewsListResponseSchema,
  manageReviewsQuerySchema,
} from "../../../../../server/manage/manage-reviews.schemas";
import {
  listManageReviewsMetadata,
  mutateManageReviewsMetadata,
} from "../../../../../server/manage/manage-reviews.route-metadata";
import {
  createManageReview,
  listManageReviews,
} from "../../../../../server/manage/manage-reviews.service";

export const GET = createTenantRoute<
  z.output<typeof manageReviewsQuerySchema>,
  z.output<typeof manageReviewsListResponseSchema>
>({
  metadata: listManageReviewsMetadata,
  input: manageReviewsQuerySchema,
  output: manageReviewsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listManageReviews(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createManageReviewBodySchema>,
  z.output<typeof manageReviewResponseSchema>
>({
  metadata: mutateManageReviewsMetadata,
  body: createManageReviewBodySchema,
  output: manageReviewResponseSchema,
  handler: async ({ tx, ctx, input }) => createManageReview(tx, ctx, input),
});
