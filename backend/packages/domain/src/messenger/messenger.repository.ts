import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type ConversationRow = {
  id: string;
  subject: string | null;
  status: string;
  updated_at: Date;
  message_count: number;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_membership_id: string;
  body: string;
  sent_at: Date;
};

export const messengerRepository = {
  async insertConversation(
    tx: TenantTx,
    args: { subject?: string | null; metadataJson?: unknown },
  ): Promise<ConversationRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into messenger_conversations (id, tenant_id, subject, status, metadata_json, created_at, updated_at)
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.subject ?? null},
        'open',
        ${args.metadataJson ? JSON.stringify(args.metadataJson) : null}::jsonb,
        now(),
        now()
      )
      returning id, subject, status, updated_at
    `;
    const row = rows[0];
    if (!row) throw new Error("CONVERSATION_INSERT_FAILED");
    return {
      id: String(row["id"]),
      subject: typeof row["subject"] === "string" ? row["subject"] : null,
      status: String(row["status"]),
      updated_at: row["updated_at"] as Date,
      message_count: 0,
    };
  },

  async listConversations(
    tx: TenantTx,
    args: { status?: string; cursor?: string; limit: number },
  ): Promise<ConversationRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        c.id,
        c.subject,
        c.status,
        c.updated_at,
        count(m.id) as message_count
      from messenger_conversations c
      left join messenger_messages m on m.conversation_id = c.id and m.tenant_id = c.tenant_id
      where (${args.status ?? null}::text is null or c.status = ${args.status ?? null})
        and (${args.cursor ?? null}::uuid is null or c.id < ${args.cursor ?? null}::uuid)
      group by c.id, c.subject, c.status, c.updated_at
      order by c.updated_at desc, c.id desc
      limit ${args.limit + 1}
    `;
    return rows.map((row) => ({
      id: String(row["id"]),
      subject: typeof row["subject"] === "string" ? row["subject"] : null,
      status: String(row["status"]),
      updated_at: row["updated_at"] as Date,
      message_count: Number(row["message_count"]),
    }));
  },

  async findConversationById(
    tx: TenantTx,
    conversationId: string,
  ): Promise<ConversationRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        c.id,
        c.subject,
        c.status,
        c.updated_at,
        count(m.id) as message_count
      from messenger_conversations c
      left join messenger_messages m on m.conversation_id = c.id and m.tenant_id = c.tenant_id
      where c.id = ${conversationId}::uuid
      group by c.id, c.subject, c.status, c.updated_at
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row["id"]),
      subject: typeof row["subject"] === "string" ? row["subject"] : null,
      status: String(row["status"]),
      updated_at: row["updated_at"] as Date,
      message_count: Number(row["message_count"]),
    };
  },

  async insertMessage(
    tx: TenantTx,
    args: {
      conversationId: string;
      senderMembershipId: string;
      body: string;
      metadataJson?: unknown;
    },
  ): Promise<MessageRow> {
    const id = randomUUID();
    const sentAt = new Date();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into messenger_messages (
        id, tenant_id, conversation_id, sender_membership_id, body, metadata_json, sent_at, created_at, updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.conversationId}::uuid,
        ${args.senderMembershipId}::uuid,
        ${args.body},
        ${args.metadataJson ? JSON.stringify(args.metadataJson) : null}::jsonb,
        ${sentAt}::timestamptz,
        now(),
        now()
      )
      returning id, conversation_id, sender_membership_id, body, sent_at
    `;
    const row = rows[0];
    if (!row) throw new Error("MESSAGE_INSERT_FAILED");

    await tx.$executeRaw`
      update messenger_conversations set updated_at = now() where id = ${args.conversationId}::uuid
    `;

    return {
      id: String(row["id"]),
      conversation_id: String(row["conversation_id"]),
      sender_membership_id: String(row["sender_membership_id"]),
      body: String(row["body"]),
      sent_at: row["sent_at"] as Date,
    };
  },

  async listMessages(
    tx: TenantTx,
    args: { conversationId: string; cursor?: string; limit: number },
  ): Promise<MessageRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select id, conversation_id, sender_membership_id, body, sent_at
      from messenger_messages
      where conversation_id = ${args.conversationId}::uuid
        and (${args.cursor ?? null}::uuid is null or id < ${args.cursor ?? null}::uuid)
      order by sent_at desc, id desc
      limit ${args.limit + 1}
    `;
    return rows.map((row) => ({
      id: String(row["id"]),
      conversation_id: String(row["conversation_id"]),
      sender_membership_id: String(row["sender_membership_id"]),
      body: String(row["body"]),
      sent_at: row["sent_at"] as Date,
    }));
  },
};
