import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  zoomConnectionBackfillEstimateQuerySchema,
  zoomConnectionBackfillEstimateResponseSchema,
} from "@atlas/domain/reports/zoom-insights-connection.dto";
import { listZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { estimateZoomBackfill } from "@atlas/domain/reports/zoom-insights-connection.service";

export const GET = createTenantRoute<
  z.output<typeof zoomConnectionBackfillEstimateQuerySchema>,
  z.output<typeof zoomConnectionBackfillEstimateResponseSchema>
>({
  metadata: listZoomInsightsRosterMetadata,
  input: zoomConnectionBackfillEstimateQuerySchema,
  output: zoomConnectionBackfillEstimateResponseSchema,
  handler: async ({ tx, ctx, input }) =>
    estimateZoomBackfill(tx, ctx, input.rangeFrom, input.rangeTo),
});
