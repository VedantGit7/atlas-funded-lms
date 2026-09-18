import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  attributionGapsQuerySchema,
  attributionGapsResponseSchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import { getAttributionGaps } from "@atlas/domain/sales-marketing/sales-marketing.service";
import { routeMetadata } from "./route.metadata";

/**
 * `GET /api/v1/sales/attribution/unattributed` — events that cannot be credited
 * to a campaign, scanned across the window rather than over a loaded page.
 *
 * Sits beside the `[eventId]` segment, which Next resolves after this static
 * one.
 */
export const GET = createTenantRoute<
  z.output<typeof attributionGapsQuerySchema>,
  z.output<typeof attributionGapsResponseSchema>
>({
  metadata: routeMetadata,
  input: attributionGapsQuerySchema,
  output: attributionGapsResponseSchema,
  handler: async ({ tx, ctx, input }) => getAttributionGaps(tx, ctx, input),
});
