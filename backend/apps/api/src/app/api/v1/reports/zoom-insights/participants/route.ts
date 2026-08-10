import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  zoomPeopleListQuerySchema,
  zoomPeopleListResponseSchema,
} from "@atlas/domain/reports/zoom-insights-roster.dto";
import { listZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { listZoomInsightsPeople } from "@atlas/domain/reports/zoom-insights-roster.service";

export const GET = createTenantRoute<
  z.output<typeof zoomPeopleListQuerySchema>,
  z.output<typeof zoomPeopleListResponseSchema>
>({
  metadata: listZoomInsightsRosterMetadata,
  input: zoomPeopleListQuerySchema,
  output: zoomPeopleListResponseSchema,
  handler: async ({ tx, ctx, input }) => listZoomInsightsPeople(tx, ctx, input),
});
