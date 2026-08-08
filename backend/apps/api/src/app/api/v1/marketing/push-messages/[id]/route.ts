import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  pushMessageResponseSchema,
  updatePushMessageTitleBodySchema,
} from "../../../../../../server/push-messages/push-messages.schemas";
import {
  listPushMessagesMetadata,
  mutatePushMessagesMetadata,
} from "../../../../../../server/push-messages/push-messages.route-metadata";
import {
  getPushMessage,
  updatePushMessageTitle,
} from "../../../../../../server/push-messages/push-messages.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof pushMessageResponseSchema>,
  typeof paramsSchema
>({
  metadata: listPushMessagesMetadata,
  params: paramsSchema,
  output: pushMessageResponseSchema,
  handler: async ({ tx, ctx, params }) => getPushMessage(tx, ctx, params["id"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updatePushMessageTitleBodySchema>,
  z.output<typeof pushMessageResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutatePushMessagesMetadata,
  params: paramsSchema,
  body: updatePushMessageTitleBodySchema,
  output: pushMessageResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updatePushMessageTitle(tx, ctx, params["id"], input),
});
