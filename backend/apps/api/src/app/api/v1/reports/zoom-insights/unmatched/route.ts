import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  zoomUnmatchedListQuerySchema,
  zoomUnmatchedListResponseSchema,
} from "@atlas/domain/reports/zoom-insights-roster.dto";
import { listZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { listZoomUnmatchedIdentities } from "@atlas/domain/reports/zoom-insights-unmatched.service";

export const GET = createTenantRoute<
  z.output<typeof zoomUnmatchedListQuerySchema>,
  z.output<typeof zoomUnmatchedListResponseSchema>
>({
  metadata: listZoomInsightsRosterMetadata,
  input: zoomUnmatchedListQuerySchema,
  output: zoomUnmatchedListResponseSchema,
  handler: async ({ tx, ctx, input }) => listZoomUnmatchedIdentities(tx, ctx, input),
});
