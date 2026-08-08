import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createAttributionEventBodySchema,
  createAttributionEventResponseSchema,
  listAttributionEventsQuerySchema,
  listAttributionEventsResponseSchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import {
  createAttributionEventMetadata,
  listAttributionEventsMetadata,
} from "@atlas/domain/sales-marketing/sales-marketing.route-metadata";
import {
  createAttributionEvent,
  listAttributionEvents,
} from "@atlas/domain/sales-marketing/sales-marketing.service";

export const GET = createTenantRoute<
  z.output<typeof listAttributionEventsQuerySchema>,
  z.output<typeof listAttributionEventsResponseSchema>
>({
  metadata: listAttributionEventsMetadata,
  input: listAttributionEventsQuerySchema,
  output: listAttributionEventsResponseSchema,
  handler: async ({ tx, ctx, input }) => listAttributionEvents(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createAttributionEventBodySchema>,
  z.output<typeof createAttributionEventResponseSchema>
>({
  metadata: createAttributionEventMetadata,
  input: createAttributionEventBodySchema,
  output: createAttributionEventResponseSchema,
  handler: async ({ tx, ctx, input }) => createAttributionEvent(tx, ctx, input),
});
