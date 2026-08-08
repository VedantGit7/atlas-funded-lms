import { z } from "zod";
import { pageInfoSchema, rejectClientTenantFields } from "../shared/domain.dto";

export const createConversationBodySchema = rejectClientTenantFields
  .extend({
    subject: z.string().max(512).optional(),
    metadataJson: z.record(z.unknown()).optional(),
  })
  .strict();

export const sendMessageBodySchema = rejectClientTenantFields
  .extend({
    body: z.string().min(1).max(10000),
    metadataJson: z.record(z.unknown()).optional(),
  })
  .strict();

export const listConversationsQuerySchema = rejectClientTenantFields
  .extend({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(["open", "closed"]).optional(),
  })
  .strict();

export const listMessagesQuerySchema = rejectClientTenantFields
  .extend({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const conversationDtoSchema = z
  .object({
    id: z.string().uuid(),
    subject: z.string().nullable(),
    status: z.string(),
    messageCount: z.number().int(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const messageDtoSchema = z
  .object({
    id: z.string().uuid(),
    conversationId: z.string().uuid(),
    senderMembershipId: z.string().uuid(),
    body: z.string(),
    sentAt: z.string().datetime(),
  })
  .strict();

export const conversationResponseSchema = z.object({ data: conversationDtoSchema });
export const conversationListResponseSchema = z.object({
  data: z.object({
    items: z.array(conversationDtoSchema),
    pageInfo: pageInfoSchema,
  }),
});
export const messageResponseSchema = z.object({ data: messageDtoSchema });
export const messageListResponseSchema = z.object({
  data: z.object({
    items: z.array(messageDtoSchema),
    pageInfo: pageInfoSchema,
  }),
});
