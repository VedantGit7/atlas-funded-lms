import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createPushMessageBodySchema,
  pushMessageResponseSchema,
  pushMessagesListQuerySchema,
  pushMessagesListResponseSchema,
} from "../../../../../server/push-messages/push-messages.schemas";
import {
  listPushMessagesMetadata,
  mutatePushMessagesMetadata,
} from "../../../../../server/push-messages/push-messages.route-metadata";
import {
  createPushMessage,
  listPushMessages,
} from "../../../../../server/push-messages/push-messages.service";

export const GET = createTenantRoute<
  z.output<typeof pushMessagesListQuerySchema>,
  z.output<typeof pushMessagesListResponseSchema>
>({
  metadata: listPushMessagesMetadata,
  input: pushMessagesListQuerySchema,
  output: pushMessagesListResponseSchema,
  handler: async ({ tx, ctx, input }) => listPushMessages(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createPushMessageBodySchema>,
  z.output<typeof pushMessageResponseSchema>
>({
  metadata: mutatePushMessagesMetadata,
  body: createPushMessageBodySchema,
  output: pushMessageResponseSchema,
  handler: async ({ tx, ctx, input }) => createPushMessage(tx, ctx, input),
});
