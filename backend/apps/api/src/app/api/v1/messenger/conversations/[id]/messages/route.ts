import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  listMessagesQuerySchema,
  messageListResponseSchema,
  messageResponseSchema,
  sendMessageBodySchema,
} from "@atlas/domain/messenger/messenger.dto";
import {
  listMessagesMetadata,
  sendMessageMetadata,
} from "@atlas/domain/messenger/messenger.route-metadata";
import { listMessages, sendMessage } from "@atlas/domain/messenger/messenger.service";
import { z as zod } from "zod";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  z.output<typeof listMessagesQuerySchema>,
  z.output<typeof messageListResponseSchema>,
  typeof paramsSchema
>({
  metadata: listMessagesMetadata,
  params: paramsSchema,
  input: listMessagesQuerySchema,
  output: messageListResponseSchema,
  handler: async ({ tx, ctx, params, input }) => listMessages(tx, ctx, params["id"], input),
});

export const POST = createTenantRoute<
  z.output<typeof sendMessageBodySchema>,
  z.output<typeof messageResponseSchema>,
  typeof paramsSchema
>({
  metadata: sendMessageMetadata,
  params: paramsSchema,
  input: sendMessageBodySchema,
  output: messageResponseSchema,
  handler: async ({ tx, ctx, params, input }) => sendMessage(tx, ctx, params["id"], input),
});
