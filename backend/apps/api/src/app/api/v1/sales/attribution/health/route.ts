import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  attributionHealthQuerySchema,
  attributionHealthResponseSchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import { getAttributionHealth } from "@atlas/domain/sales-marketing/sales-marketing.service";
import { routeMetadata } from "./route.metadata";

/**
 * `GET /api/v1/sales/attribution/health` — the log's daily shape.
 *
 * Sits beside the `[eventId]` segment, which Next resolves after this static
 * one.
 */
export const GET = createTenantRoute<
  z.output<typeof attributionHealthQuerySchema>,
  z.output<typeof attributionHealthResponseSchema>
>({
  metadata: routeMetadata,
  input: attributionHealthQuerySchema,
  output: attributionHealthResponseSchema,
  handler: async ({ tx, ctx, input }) => getAttributionHealth(tx, ctx, input),
});
