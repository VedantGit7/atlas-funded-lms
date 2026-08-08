import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  appealIdParamsSchema,
  reviewAppealBodySchema,
  reviewAppealResponseSchema,
} from "../../../../../../server/moderation/moderation.dto";
import { reviewAppeal } from "../../../../../../server/moderation/moderation.service";
import { reviewAppealMetadata } from "../../../../../../server/moderation/moderation.route-metadata";

type ReviewAppealBody = z.output<typeof reviewAppealBodySchema>;
type ReviewAppealResponse = z.output<typeof reviewAppealResponseSchema>;

export const POST = createTenantRoute<
  ReviewAppealBody,
  ReviewAppealResponse,
  typeof appealIdParamsSchema
>({
  metadata: reviewAppealMetadata,
  params: appealIdParamsSchema,
  body: reviewAppealBodySchema,
  output: reviewAppealResponseSchema,
  handler: async ({ tx, ctx, params, input }) => reviewAppeal(tx, ctx, params["id"] ?? "", input),
});
