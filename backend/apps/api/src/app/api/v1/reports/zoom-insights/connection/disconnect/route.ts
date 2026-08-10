import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  zoomConnectionDisconnectBodySchema,
  zoomConnectionDisconnectResponseSchema,
} from "@atlas/domain/reports/zoom-insights-connection.dto";
import { mutateZoomConnectionMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { disconnectZoomConnection } from "@atlas/domain/reports/zoom-insights-connection.service";

export const POST = createTenantRoute<
  z.output<typeof zoomConnectionDisconnectBodySchema>,
  z.output<typeof zoomConnectionDisconnectResponseSchema>
>({
  metadata: mutateZoomConnectionMetadata,
  input: zoomConnectionDisconnectBodySchema,
  output: zoomConnectionDisconnectResponseSchema,
  handler: async ({ tx, ctx, input }) => disconnectZoomConnection(tx, ctx, input),
});
