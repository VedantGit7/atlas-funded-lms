import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  zoomConnectionScheduleBodySchema,
  zoomConnectionScheduleResponseSchema,
} from "@atlas/domain/reports/zoom-insights-connection.dto";
import { mutateZoomConnectionMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import { updateZoomConnectionSchedule } from "@atlas/domain/reports/zoom-insights-connection.service";

export const PATCH = createTenantRoute<
  z.output<typeof zoomConnectionScheduleBodySchema>,
  z.output<typeof zoomConnectionScheduleResponseSchema>
>({
  metadata: mutateZoomConnectionMetadata,
  input: zoomConnectionScheduleBodySchema,
  output: zoomConnectionScheduleResponseSchema,
  handler: async ({ tx, ctx, input }) => updateZoomConnectionSchedule(tx, ctx, input),
});
