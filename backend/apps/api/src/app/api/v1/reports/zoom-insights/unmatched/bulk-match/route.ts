import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  zoomUnmatchedBulkMatchBodySchema,
  zoomUnmatchedBulkMatchResponseSchema,
} from "@atlas/domain/reports/zoom-insights-roster.dto";
import { mutateZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { bulkMatchZoomUnmatched } from "@atlas/domain/reports/zoom-insights-unmatched.service";

export const POST = createTenantRoute<
  z.output<typeof zoomUnmatchedBulkMatchBodySchema>,
  z.output<typeof zoomUnmatchedBulkMatchResponseSchema>
>({
  metadata: mutateZoomInsightsRosterMetadata,
  input: zoomUnmatchedBulkMatchBodySchema,
  output: zoomUnmatchedBulkMatchResponseSchema,
  handler: async ({ tx, ctx, input }) => bulkMatchZoomUnmatched(tx, ctx, input),
});
