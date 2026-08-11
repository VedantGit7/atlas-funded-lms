import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  insightLibraryMutationBodySchema,
  insightLibraryQuerySchema,
  insightLibraryResponseSchema,
} from "../../../../../../server/insights/insights.schemas";
import {
  getInsightLibrary,
  mutateInsightLibrary,
} from "../../../../../../server/insights/insights.service";
import {
  insightDashboardMetadata,
  insightLayoutMutateMetadata,
} from "../../../../../../server/insights/insights.route-metadata";

const paramsSchema = z.object({ slug: z.string().min(1) });

export const GET = createTenantRoute<
  Zod.output<typeof insightLibraryQuerySchema>,
  Zod.output<typeof insightLibraryResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightDashboardMetadata,
  params: paramsSchema,
  input: insightLibraryQuerySchema,
  output: insightLibraryResponseSchema,
  handler: async ({ tx, ctx, params, input }) => ({
    data: await getInsightLibrary(tx, ctx, params.slug, input.range, input.target),
  }),
});

export const PATCH = createTenantRoute<
  Zod.output<typeof insightLibraryMutationBodySchema>,
  Zod.output<typeof insightLibraryResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightLayoutMutateMetadata,
  params: paramsSchema,
  body: insightLibraryMutationBodySchema,
  output: insightLibraryResponseSchema,
  handler: async ({ tx, ctx, params, input }) => ({
    data: await mutateInsightLibrary(tx, ctx, params.slug, input),
  }),
});
