import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  conversationListResponseSchema,
  conversationResponseSchema,
  createConversationBodySchema,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  messageListResponseSchema,
  messageResponseSchema,
  sendMessageBodySchema,
} from "./messenger.dto";
import { conversationNotFound } from "./messenger.errors";
import { messengerRepository, type ConversationRow, type MessageRow } from "./messenger.repository";

function toConversationDto(row: ConversationRow) {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    messageCount: row.message_count,
    updatedAt: row.updated_at.toISOString(),
  };
}

function toMessageDto(row: MessageRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderMembershipId: row.sender_membership_id,
    body: row.body,
    sentAt: row.sent_at.toISOString(),
  };
}

export async function createConversation(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = createConversationBodySchema.parse(rawBody);
  const row = await messengerRepository.insertConversation(tx, {
    subject: body.subject ?? null,
    metadataJson: body.metadataJson,
  });
  return conversationResponseSchema.parse({ data: toConversationDto(row) });
}

export async function listConversations(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = listConversationsQuerySchema.parse(rawQuery);
  const rows = await messengerRepository.listConversations(tx, {
    limit: query.limit,
    ...(query.status ? { status: query.status } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });

  const hasNextPage = rows.length > query.limit;
  const items = rows.slice(0, query.limit).map(toConversationDto);

  return conversationListResponseSchema.parse({
    data: {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
        hasNextPage,
      },
    },
  });
}

export async function sendMessage(
  tx: TenantTx,
  ctx: ServiceCtx,
  conversationId: string,
  rawBody: unknown,
) {
  const body = sendMessageBodySchema.parse(rawBody);
  const conversation = await messengerRepository.findConversationById(tx, conversationId);
  if (!conversation) throw conversationNotFound();

  const row = await messengerRepository.insertMessage(tx, {
    conversationId,
    senderMembershipId: ctx.actorMembershipId,
    body: body.body,
    metadataJson: body.metadataJson,
  });

  return messageResponseSchema.parse({ data: toMessageDto(row) });
}

export async function listMessages(
  tx: TenantTx,
  _ctx: ServiceCtx,
  conversationId: string,
  rawQuery: unknown,
) {
  const query = listMessagesQuerySchema.parse(rawQuery);
  const conversation = await messengerRepository.findConversationById(tx, conversationId);
  if (!conversation) throw conversationNotFound();

  const rows = await messengerRepository.listMessages(tx, {
    conversationId,
    limit: query.limit,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });

  const hasNextPage = rows.length > query.limit;
  const items = rows.slice(0, query.limit).map(toMessageDto);

  return messageListResponseSchema.parse({
    data: {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
        hasNextPage,
      },
    },
  });
}
