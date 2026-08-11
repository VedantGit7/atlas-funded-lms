import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  insightDigestsMutationBodySchema,
  insightDigestsQuerySchema,
  insightDigestsResponseSchema,
} from "../../../../../../server/insights/insights.schemas";
import {
  getInsightDigests,
  mutateInsightDigests,
} from "../../../../../../server/insights/insights.service";
import {
  insightDashboardMetadata,
  insightDigestsMutateMetadata,
} from "../../../../../../server/insights/insights.route-metadata";

const paramsSchema = z.object({ slug: z.string().min(1) });

export const GET = createTenantRoute<
  Zod.output<typeof insightDigestsQuerySchema>,
  Zod.output<typeof insightDigestsResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightDashboardMetadata,
  params: paramsSchema,
  input: insightDigestsQuerySchema,
  output: insightDigestsResponseSchema,
  handler: async ({ tx, ctx, params, input }) => ({
    data: await getInsightDigests(tx, ctx, params.slug, input.previewId),
  }),
});

export const PATCH = createTenantRoute<
  Zod.output<typeof insightDigestsMutationBodySchema>,
  Zod.output<typeof insightDigestsResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightDigestsMutateMetadata,
  params: paramsSchema,
  body: insightDigestsMutationBodySchema,
  output: insightDigestsResponseSchema,
  handler: async ({ tx, ctx, params, input }) => ({
    data: await mutateInsightDigests(tx, ctx, params.slug, input),
  }),
});
