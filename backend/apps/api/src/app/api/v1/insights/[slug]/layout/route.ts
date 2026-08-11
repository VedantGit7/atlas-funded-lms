import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  insightLayoutMutationBodySchema,
  insightLayoutResponseSchema,
} from "../../../../../../server/insights/insights.schemas";
import {
  getInsightLayout,
  mutateInsightLayout,
} from "../../../../../../server/insights/insights.service";
import {
  insightDashboardMetadata,
  insightLayoutMutateMetadata,
} from "../../../../../../server/insights/insights.route-metadata";

const paramsSchema = z.object({ slug: z.string().min(1) });

export const GET = createTenantRoute<
  undefined,
  Zod.output<typeof insightLayoutResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightDashboardMetadata,
  params: paramsSchema,
  output: insightLayoutResponseSchema,
  handler: async ({ tx, ctx, params }) => ({
    data: await getInsightLayout(tx, ctx, params.slug),
  }),
});

export const PATCH = createTenantRoute<
  Zod.output<typeof insightLayoutMutationBodySchema>,
  Zod.output<typeof insightLayoutResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightLayoutMutateMetadata,
  params: paramsSchema,
  body: insightLayoutMutationBodySchema,
  output: insightLayoutResponseSchema,
  handler: async ({ tx, ctx, params, input }) => ({
    data: await mutateInsightLayout(tx, ctx, params.slug, input),
  }),
});
