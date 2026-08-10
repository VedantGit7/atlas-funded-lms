import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  zoomConnectionSyncBodySchema,
  zoomConnectionSyncResponseSchema,
} from "@atlas/domain/reports/zoom-insights-connection.dto";
import { mutateZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { syncZoomConnectionNow } from "@atlas/domain/reports/zoom-insights-connection.service";

export const POST = createTenantRoute<
  z.output<typeof zoomConnectionSyncBodySchema>,
  z.output<typeof zoomConnectionSyncResponseSchema>
>({
  metadata: mutateZoomInsightsRosterMetadata,
  input: zoomConnectionSyncBodySchema,
  output: zoomConnectionSyncResponseSchema,
  handler: async ({ tx, ctx }) => syncZoomConnectionNow(tx, ctx),
});
