import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  zoomConnectionBackfillBodySchema,
  zoomConnectionBackfillResponseSchema,
} from "@atlas/domain/reports/zoom-insights-connection.dto";
import { mutateZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { backfillZoomConnection } from "@atlas/domain/reports/zoom-insights-connection.service";

export const POST = createTenantRoute<
  z.output<typeof zoomConnectionBackfillBodySchema>,
  z.output<typeof zoomConnectionBackfillResponseSchema>
>({
  metadata: mutateZoomInsightsRosterMetadata,
  input: zoomConnectionBackfillBodySchema,
  output: zoomConnectionBackfillResponseSchema,
  handler: async ({ tx, ctx, input }) => backfillZoomConnection(tx, ctx, input),
});
