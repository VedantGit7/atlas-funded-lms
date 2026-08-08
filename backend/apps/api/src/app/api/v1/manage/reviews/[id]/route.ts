import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  deleteManageReviewResponseSchema,
  manageReviewResponseSchema,
  updateManageReviewBodySchema,
} from "../../../../../../server/manage/manage-reviews.schemas";
import { mutateManageReviewsMetadata } from "../../../../../../server/manage/manage-reviews.route-metadata";
import {
  deleteManageReview,
  updateManageReview,
} from "../../../../../../server/manage/manage-reviews.service";
import { z as zod } from "zod";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const PATCH = createTenantRoute<
  z.output<typeof updateManageReviewBodySchema>,
  z.output<typeof manageReviewResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateManageReviewsMetadata,
  params: paramsSchema,
  body: updateManageReviewBodySchema,
  output: manageReviewResponseSchema,
  handler: async ({ tx, ctx, params, input }) => updateManageReview(tx, ctx, params["id"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteManageReviewResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateManageReviewsMetadata,
  params: paramsSchema,
  output: deleteManageReviewResponseSchema,
  handler: async ({ tx, ctx, params }) => deleteManageReview(tx, ctx, params["id"]),
});
