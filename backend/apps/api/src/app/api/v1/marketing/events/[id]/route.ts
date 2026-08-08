import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  marketingEventResponseSchema,
  updateMarketingEventBodySchema,
} from "../../../../../../server/marketing-events/marketing-events.schemas";
import {
  listMarketingEventsMetadata,
  mutateMarketingEventsMetadata,
} from "../../../../../../server/marketing-events/marketing-events.route-metadata";
import {
  getMarketingEvent,
  updateMarketingEvent,
} from "../../../../../../server/marketing-events/marketing-events.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof marketingEventResponseSchema>,
  typeof paramsSchema
>({
  metadata: listMarketingEventsMetadata,
  params: paramsSchema,
  output: marketingEventResponseSchema,
  handler: async ({ tx, ctx, params }) => getMarketingEvent(tx, ctx, params.id),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateMarketingEventBodySchema>,
  z.output<typeof marketingEventResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingEventsMetadata,
  params: paramsSchema,
  body: updateMarketingEventBodySchema,
  output: marketingEventResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateMarketingEvent(tx, ctx, params.id, input),
});
