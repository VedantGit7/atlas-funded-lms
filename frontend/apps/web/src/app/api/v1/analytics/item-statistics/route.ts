import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  analyticsItemStatisticsQuerySchema,
  analyticsItemStatisticsResponseSchema,
} from "@atlas/domain/analytics/analytics.dto";
import { queryItemStatistics } from "@atlas/domain/analytics/analytics.service";
import { analyticsItemStatisticsMetadata } from "../../../../../server/analytics/analytics.route-metadata";
import {
  resolveAssessmentItemIds,
  resolveItemReferences,
} from "../../../../../server/analytics/analytics-item-resolver";

export const GET = createTenantRoute<
  z.output<typeof analyticsItemStatisticsQuerySchema>,
  z.output<typeof analyticsItemStatisticsResponseSchema>
>({
  metadata: analyticsItemStatisticsMetadata,
  input: analyticsItemStatisticsQuerySchema,
  output: analyticsItemStatisticsResponseSchema,
  handler: async ({ tx, ctx, input }) =>
    queryItemStatistics(tx, ctx, input, {
      resolveAssessmentItemIds,
      resolveItemReferences,
    }),
});
