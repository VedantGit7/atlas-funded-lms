import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  attributionSummaryQuerySchema,
  attributionSummaryResponseSchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import { summariseAttributionEvents } from "@atlas/domain/sales-marketing/sales-marketing.service";
import { routeMetadata } from "./route.metadata";

/**
 * `GET /api/v1/sales/attribution/summary` — totals over every matching event.
 *
 * Separate from the log page because these are totals, not a window: "8 events
 * with no attribution" has to mean the tenant, not the fifty rows a screen
 * happened to load.
 */
export const GET = createTenantRoute<
  z.output<typeof attributionSummaryQuerySchema>,
  z.output<typeof attributionSummaryResponseSchema>
>({
  metadata: routeMetadata,
  input: attributionSummaryQuerySchema,
  output: attributionSummaryResponseSchema,
  handler: async ({ tx, ctx, input }) => summariseAttributionEvents(tx, ctx, input),
});
