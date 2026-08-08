import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { marketingEventRegistrationsListResponseSchema } from "../../../../../../../server/marketing-events/marketing-events.schemas";
import { listMarketingEventsMetadata } from "../../../../../../../server/marketing-events/marketing-events.route-metadata";
import { listMarketingEventRegistrations } from "../../../../../../../server/marketing-events/marketing-events.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof marketingEventRegistrationsListResponseSchema>,
  typeof paramsSchema
>({
  metadata: listMarketingEventsMetadata,
  params: paramsSchema,
  output: marketingEventRegistrationsListResponseSchema,
  handler: async ({ tx, ctx, params }) => listMarketingEventRegistrations(tx, ctx, params["id"]),
});
