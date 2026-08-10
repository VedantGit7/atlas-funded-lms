import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { zoomConnectionDetailResponseSchema } from "@atlas/domain/reports/zoom-insights-connection.dto";
import { listZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { getZoomConnectionDetail } from "@atlas/domain/reports/zoom-insights-connection.service";

export const GET = createTenantRoute<
  z.output<typeof noBodySchema>,
  z.output<typeof zoomConnectionDetailResponseSchema>
>({
  metadata: listZoomInsightsRosterMetadata,
  input: noBodySchema,
  output: zoomConnectionDetailResponseSchema,
  handler: async ({ tx, ctx }) => getZoomConnectionDetail(tx, ctx),
});
