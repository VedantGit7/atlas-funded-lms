import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { listPushMessagesMetadata } from "../../../../../server/push-messages/push-messages.route-metadata";
import {
  pushAudienceEstimateQuerySchema,
  pushAudienceEstimateResponseSchema,
} from "../../../../../server/push-messages/push-messages.schemas";
import { estimatePushAudience } from "../../../../../server/push-messages/push-messages.service";

export const GET = createTenantRoute<
  z.output<typeof pushAudienceEstimateQuerySchema>,
  z.output<typeof pushAudienceEstimateResponseSchema>
>({
  metadata: listPushMessagesMetadata,
  input: pushAudienceEstimateQuerySchema,
  output: pushAudienceEstimateResponseSchema,
  handler: async ({ tx, ctx, input }) => estimatePushAudience(tx, ctx, input),
});
