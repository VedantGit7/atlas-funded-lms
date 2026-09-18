import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { getMessengerHubSummaryMetadata } from "../../../../../server/messenger-hub/messenger-hub.route-metadata";
import { messengerHubSummaryResponseSchema } from "../../../../../server/messenger-hub/messenger-hub.schemas";
import { getMessengerHubSummary } from "../../../../../server/messenger-hub/messenger-hub.service";

export const GET = createTenantRoute<undefined, z.output<typeof messengerHubSummaryResponseSchema>>(
  {
    metadata: getMessengerHubSummaryMetadata,
    output: messengerHubSummaryResponseSchema,
    handler: async ({ tx, ctx }) => getMessengerHubSummary(tx, ctx),
  },
);
