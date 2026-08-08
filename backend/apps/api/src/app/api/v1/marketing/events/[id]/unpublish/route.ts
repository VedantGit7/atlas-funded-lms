import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { z as zod } from "zod";
import { marketingEventResponseSchema } from "../../../../../../../server/marketing-events/marketing-events.schemas";
import { mutateMarketingEventsMetadata } from "../../../../../../../server/marketing-events/marketing-events.route-metadata";
import { unpublishMarketingEvent } from "../../../../../../../server/marketing-events/marketing-events.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof marketingEventResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingEventsMetadata,
  params: paramsSchema,
  body: noBodySchema,
  output: marketingEventResponseSchema,
  handler: async ({ tx, ctx, params }) => unpublishMarketingEvent(tx, ctx, params["id"]),
});
