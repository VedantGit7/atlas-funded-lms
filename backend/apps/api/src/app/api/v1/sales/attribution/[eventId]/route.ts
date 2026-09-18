import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  attributionEventParamsSchema,
  attributionEventResponseSchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import { getAttributionEvent } from "@atlas/domain/sales-marketing/sales-marketing.service";
import { routeMetadata } from "./route.metadata";

/**
 * `GET /api/v1/sales/attribution/[eventId]` — one event in full.
 *
 * Sits beside the static `summary` segment, which Next resolves first.
 */
export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof attributionEventResponseSchema>,
  typeof attributionEventParamsSchema
>({
  metadata: routeMetadata,
  params: attributionEventParamsSchema,
  output: attributionEventResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const eventId = params["eventId"];
    if (!eventId) throw new Error("Missing event id");
    return await getAttributionEvent(tx, ctx, eventId);
  },
});
