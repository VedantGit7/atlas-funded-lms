import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportAttributionEventsQuerySchema,
  exportAttributionEventsResponseSchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import { exportAttributionEvents } from "@atlas/domain/sales-marketing/sales-marketing.service";
import { routeMetadata } from "./route.metadata";

/**
 * `GET /api/v1/sales/attribution/export` — the whole filtered log in one
 * response, for a CSV the operator downloads.
 *
 * A GET because it reads and does not mutate; the ceiling and whether it was
 * reached are both in the payload. Sits beside the `[eventId]` segment, which
 * Next resolves after this static one.
 */
export const GET = createTenantRoute<
  z.output<typeof exportAttributionEventsQuerySchema>,
  z.output<typeof exportAttributionEventsResponseSchema>
>({
  metadata: routeMetadata,
  input: exportAttributionEventsQuerySchema,
  output: exportAttributionEventsResponseSchema,
  handler: async ({ tx, ctx, input }) => exportAttributionEvents(tx, ctx, input),
});
