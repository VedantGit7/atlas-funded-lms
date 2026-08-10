import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  superLiveInsightsCompareCandidatesQuerySchema,
  superLiveInsightsCompareCandidatesResponseSchema,
} from "@atlas/domain/reports/super-live-insights-compare.dto";
import { listSuperLiveInsightsCompareCandidatesMetadata } from "@atlas/domain/reports/super-live-insights-compare.route-metadata";
import { listSuperLiveInsightsCompareCandidates } from "@atlas/domain/reports/super-live-insights-compare.service";

export const GET = createTenantRoute<
  z.output<typeof superLiveInsightsCompareCandidatesQuerySchema>,
  z.output<typeof superLiveInsightsCompareCandidatesResponseSchema>
>({
  metadata: listSuperLiveInsightsCompareCandidatesMetadata,
  input: superLiveInsightsCompareCandidatesQuerySchema,
  output: superLiveInsightsCompareCandidatesResponseSchema,
  handler: async ({ tx, ctx, input }) => listSuperLiveInsightsCompareCandidates(tx, ctx, input),
});
