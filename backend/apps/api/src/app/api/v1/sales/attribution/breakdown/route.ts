import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  attributionBreakdownQuerySchema,
  attributionBreakdownResponseSchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import { getAttributionBreakdown } from "@atlas/domain/sales-marketing/sales-marketing.service";
import { routeMetadata } from "./route.metadata";

/**
 * `GET /api/v1/sales/attribution/breakdown` — the log grouped by source,
 * medium or campaign, across the whole log rather than a loaded page.
 *
 * Sits beside the `[eventId]` segment, which Next resolves after this static
 * one.
 */
export const GET = createTenantRoute<
  z.output<typeof attributionBreakdownQuerySchema>,
  z.output<typeof attributionBreakdownResponseSchema>
>({
  metadata: routeMetadata,
  input: attributionBreakdownQuerySchema,
  output: attributionBreakdownResponseSchema,
  handler: async ({ tx, ctx, input }) => getAttributionBreakdown(tx, ctx, input),
});
