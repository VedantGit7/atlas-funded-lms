import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  attributionAnomaliesQuerySchema,
  attributionAnomaliesResponseSchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import { getAttributionAnomalies } from "@atlas/domain/sales-marketing/sales-marketing.service";
import { routeMetadata } from "./route.metadata";

/**
 * `GET /api/v1/sales/attribution/anomalies` — the offending events themselves.
 *
 * Sits beside the `[eventId]` segment, which Next resolves after this static
 * one.
 */
export const GET = createTenantRoute<
  z.output<typeof attributionAnomaliesQuerySchema>,
  z.output<typeof attributionAnomaliesResponseSchema>
>({
  metadata: routeMetadata,
  input: attributionAnomaliesQuerySchema,
  output: attributionAnomaliesResponseSchema,
  handler: async ({ tx, ctx, input }) => getAttributionAnomalies(tx, ctx, input),
});
