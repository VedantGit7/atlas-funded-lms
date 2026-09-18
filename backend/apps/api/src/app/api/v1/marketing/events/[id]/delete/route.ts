import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  deleteMarketingEventBodySchema,
  deleteMarketingEventResponseSchema,
} from "../../../../../../../server/marketing-events/marketing-events.schemas";
import { mutateMarketingEventsMetadata } from "../../../../../../../server/marketing-events/marketing-events.route-metadata";
import { deleteMarketingEvent } from "../../../../../../../server/marketing-events/marketing-events.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof deleteMarketingEventBodySchema>,
  z.output<typeof deleteMarketingEventResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingEventsMetadata,
  params: paramsSchema,
  body: deleteMarketingEventBodySchema,
  output: deleteMarketingEventResponseSchema,
  handler: async ({ tx, ctx, params, input }) => deleteMarketingEvent(tx, ctx, params["id"], input),
});
