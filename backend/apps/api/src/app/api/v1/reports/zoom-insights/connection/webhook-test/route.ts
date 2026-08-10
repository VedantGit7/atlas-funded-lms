import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  zoomConnectionSyncBodySchema,
  zoomConnectionWebhookTestResponseSchema,
} from "@atlas/domain/reports/zoom-insights-connection.dto";
import { mutateZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { sendZoomWebhookTest } from "@atlas/domain/reports/zoom-insights-connection.service";

export const POST = createTenantRoute<
  z.output<typeof zoomConnectionSyncBodySchema>,
  z.output<typeof zoomConnectionWebhookTestResponseSchema>
>({
  metadata: mutateZoomInsightsRosterMetadata,
  input: zoomConnectionSyncBodySchema,
  output: zoomConnectionWebhookTestResponseSchema,
  handler: async ({ tx, ctx }) => sendZoomWebhookTest(tx, ctx),
});
