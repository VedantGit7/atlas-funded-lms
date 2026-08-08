import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { listPushMessagesMetadata } from "../../../../../server/push-messages/push-messages.route-metadata";
import { pushMessagesSummaryResponseSchema } from "../../../../../server/push-messages/push-messages.schemas";
import { getPushMessagesSummary } from "../../../../../server/push-messages/push-messages.service";

export const GET = createTenantRoute<
  undefined,
  z.output<typeof pushMessagesSummaryResponseSchema>
>({
  metadata: listPushMessagesMetadata,
  output: pushMessagesSummaryResponseSchema,
  handler: async ({ tx, ctx }) => getPushMessagesSummary(tx, ctx),
});
