import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  conversationListResponseSchema,
  conversationResponseSchema,
  createConversationBodySchema,
  listConversationsQuerySchema,
} from "@atlas/domain/messenger/messenger.dto";
import {
  createConversationMetadata,
  listConversationsMetadata,
} from "@atlas/domain/messenger/messenger.route-metadata";
import { createConversation, listConversations } from "@atlas/domain/messenger/messenger.service";

export const GET = createTenantRoute<
  z.output<typeof listConversationsQuerySchema>,
  z.output<typeof conversationListResponseSchema>
>({
  metadata: listConversationsMetadata,
  input: listConversationsQuerySchema,
  output: conversationListResponseSchema,
  handler: async ({ tx, ctx, input }) => listConversations(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createConversationBodySchema>,
  z.output<typeof conversationResponseSchema>
>({
  metadata: createConversationMetadata,
  input: createConversationBodySchema,
  output: conversationResponseSchema,
  handler: async ({ tx, ctx, input }) => createConversation(tx, ctx, input),
});
