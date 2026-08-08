import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  pushMessageResponseSchema,
  sendPushMessageBodySchema,
} from "../../../../../../../server/push-messages/push-messages.schemas";
import { mutatePushMessagesMetadata } from "../../../../../../../server/push-messages/push-messages.route-metadata";
import { sendPushMessage } from "../../../../../../../server/push-messages/push-messages.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  z.output<typeof sendPushMessageBodySchema>,
  z.output<typeof pushMessageResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutatePushMessagesMetadata,
  params: paramsSchema,
  body: sendPushMessageBodySchema,
  output: pushMessageResponseSchema,
  handler: async ({ tx, ctx, params, input }) => sendPushMessage(tx, ctx, params.id, input),
});
