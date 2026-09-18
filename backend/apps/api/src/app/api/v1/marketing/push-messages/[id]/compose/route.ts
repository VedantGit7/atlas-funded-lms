import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  composePushMessageBodySchema,
  pushMessageResponseSchema,
} from "../../../../../../../server/push-messages/push-messages.schemas";
import { mutatePushMessagesMetadata } from "../../../../../../../server/push-messages/push-messages.route-metadata";
import { composePushMessage } from "../../../../../../../server/push-messages/push-messages.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof composePushMessageBodySchema>,
  z.output<typeof pushMessageResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutatePushMessagesMetadata,
  params: paramsSchema,
  body: composePushMessageBodySchema,
  output: pushMessageResponseSchema,
  handler: async ({ tx, ctx, params, input }) => composePushMessage(tx, ctx, params["id"], input),
});
