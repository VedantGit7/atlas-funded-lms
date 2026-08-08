import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createMarketingEventBodySchema,
  marketingEventResponseSchema,
  marketingEventsListQuerySchema,
  marketingEventsListResponseSchema,
} from "../../../../../server/marketing-events/marketing-events.schemas";
import {
  listMarketingEventsMetadata,
  mutateMarketingEventsMetadata,
} from "../../../../../server/marketing-events/marketing-events.route-metadata";
import {
  createMarketingEvent,
  listMarketingEvents,
} from "../../../../../server/marketing-events/marketing-events.service";

export const GET = createTenantRoute<
  z.output<typeof marketingEventsListQuerySchema>,
  z.output<typeof marketingEventsListResponseSchema>
>({
  metadata: listMarketingEventsMetadata,
  input: marketingEventsListQuerySchema,
  output: marketingEventsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listMarketingEvents(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createMarketingEventBodySchema>,
  z.output<typeof marketingEventResponseSchema>
>({
  metadata: mutateMarketingEventsMetadata,
  body: createMarketingEventBodySchema,
  output: marketingEventResponseSchema,
  handler: async ({ tx, ctx, input }) => createMarketingEvent(tx, ctx, input),
});
