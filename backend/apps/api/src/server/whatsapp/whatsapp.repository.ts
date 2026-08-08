import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type WhatsappConnectionRow = {
  id: string;
  status: string;
  provider_mode: string;
  display_name: string | null;
  phone_number: string | null;
  phone_number_id: string | null;
  waba_id: string | null;
  access_token_ciphertext: string | null;
  access_token_last4: string | null;
  quality_rating: string | null;
  messaging_limit: number;
  connected_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type WhatsappTemplateRow = {
  id: string;
  name: string;
  category: string;
  language: string;
  header_type: string;
  header_text: string | null;
  header_image_url: string | null;
  body: string;
  footer: string | null;
  buttons_json: unknown;
  status: string;
  meta_template_id: string | null;
  rejection_reason: string | null;
  created_by_membership_id: string;
  created_at: Date;
  updated_at: Date;
};

export type WhatsappCampaignRow = {
  id: string;
  title: string;
  status: string;
  audience_type: string | null;
  audience_batch_id: string | null;
  audience_batch_name: string | null;
  template_id: string | null;
  template_name: string | null;
  template_body: string | null;
  template_language: string | null;
  template_status: string | null;
  recipient_count: number;
  delivered_count: number;
  failed_count: number;
  scheduled_at: Date | null;
  sent_at: Date | null;
  created_by_membership_id: string;
  created_at: Date;
  updated_at: Date;
};

export type WhatsappRecipient = {
  membership_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
};

export type WhatsappConversationRow = {
  id: string;
  wa_phone: string;
  membership_id: string | null;
  learner_name: string | null;
  last_message_at: Date;
  unread_count: number;
  last_message_preview: string | null;
};

export type WhatsappInboxMessageRow = {
  id: string;
  direction: string;
  body: string;
  status: string;
  created_at: Date;
};

export const whatsappRepository = {
  async getConnection(tx: TenantTx): Promise<WhatsappConnectionRow | null> {
    const rows = await tx.$queryRaw<WhatsappConnectionRow[]>`
      select
        id::text,
        status,
        provider_mode,
        display_name,
        phone_number,
        phone_number_id,
        waba_id,
        access_token_ciphertext,
        access_token_last4,
        quality_rating,
        messaging_limit,
        connected_at,
        created_at,
        updated_at
      from whatsapp_connections
      limit 1
    `;
    return rows[0] ?? null;
  },

  async upsertConnection(
    tx: TenantTx,
    args: {
      status: string;
      providerMode: string;
      displayName: string;
      phoneNumber: string;
      phoneNumberId: string | null;
      wabaId: string | null;
      accessTokenCiphertext: string | null;
      accessTokenLast4: string | null;
    },
  ): Promise<string> {
    const existing = await this.getConnection(tx);
    if (existing) {
      await tx.$executeRaw`
        update whatsapp_connections
        set
          status = ${args.status},
          provider_mode = ${args.providerMode},
          display_name = ${args.displayName},
          phone_number = ${args.phoneNumber},
          phone_number_id = ${args.phoneNumberId},
          waba_id = ${args.wabaId},
          access_token_ciphertext = ${args.accessTokenCiphertext},
          access_token_last4 = ${args.accessTokenLast4},
          connected_at = now(),
          updated_at = now()
        where id = ${existing.id}::uuid
      `;
      return existing.id;
    }
    const id = randomUUID();
    await tx.$executeRaw`
      insert into whatsapp_connections (
        id, tenant_id, status, provider_mode, display_name, phone_number,
        phone_number_id, waba_id, access_token_ciphertext, access_token_last4,
        messaging_limit, connected_at, created_at, updated_at
      ) values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.status},
        ${args.providerMode},
        ${args.displayName},
        ${args.phoneNumber},
        ${args.phoneNumberId},
        ${args.wabaId},
        ${args.accessTokenCiphertext},
        ${args.accessTokenLast4},
        250,
        now(),
        now(),
        now()
      )
    `;
    return id;
  },

  async disconnect(tx: TenantTx): Promise<void> {
    await tx.$executeRaw`
      update whatsapp_connections
      set
        status = 'DISCONNECTED',
        access_token_ciphertext = null,
        access_token_last4 = null,
        connected_at = null,
        updated_at = now()
    `;
  },

  async listTemplates(tx: TenantTx): Promise<WhatsappTemplateRow[]> {
    return tx.$queryRaw<WhatsappTemplateRow[]>`
      select
        id::text, name, category, language, header_type, header_text, header_image_url,
        body, footer, buttons_json, status, meta_template_id, rejection_reason,
        created_by_membership_id::text, created_at, updated_at
      from whatsapp_templates
      order by created_at desc
    `;
  },

  async findTemplate(tx: TenantTx, id: string): Promise<WhatsappTemplateRow | null> {
    const rows = await tx.$queryRaw<WhatsappTemplateRow[]>`
      select
        id::text, name, category, language, header_type, header_text, header_image_url,
        body, footer, buttons_json, status, meta_template_id, rejection_reason,
        created_by_membership_id::text, created_at, updated_at
      from whatsapp_templates
      where id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertTemplate(
    tx: TenantTx,
    args: {
      name: string;
      category: string;
      language: string;
      headerType: string;
      headerText: string | null;
      headerImageUrl: string | null;
      body: string;
      footer: string | null;
      buttonsJson: unknown;
      status: string;
      metaTemplateId: string | null;
      rejectionReason: string | null;
      createdByMembershipId: string;
    },
  ): Promise<string> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into whatsapp_templates (
        id, tenant_id, name, category, language, header_type, header_text, header_image_url,
        body, footer, buttons_json, status, meta_template_id, rejection_reason,
        created_by_membership_id, created_at, updated_at
      ) values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.name},
        ${args.category},
        ${args.language},
        ${args.headerType},
        ${args.headerText},
        ${args.headerImageUrl},
        ${args.body},
        ${args.footer},
        ${JSON.stringify(args.buttonsJson)}::jsonb,
        ${args.status},
        ${args.metaTemplateId},
        ${args.rejectionReason},
        ${args.createdByMembershipId}::uuid,
        now(),
        now()
      )
    `;
    return id;
  },

  async listCampaigns(
    tx: TenantTx,
    args: { status?: string; q?: string; createdOn?: string; limit: number },
  ): Promise<WhatsappCampaignRow[]> {
    const status = args.status && args.status !== "ALL" ? args.status : null;
    const q = args.q?.trim() ?? "";
    const createdOn = args.createdOn ?? null;
    return tx.$queryRaw<WhatsappCampaignRow[]>`
      select
        c.id::text,
        c.title,
        c.status,
        c.audience_type,
        c.audience_batch_id::text,
        b.name as audience_batch_name,
        c.template_id::text,
        t.name as template_name,
        t.body as template_body,
        t.language as template_language,
        t.status as template_status,
        c.recipient_count,
        c.delivered_count,
        c.failed_count,
        c.scheduled_at,
        c.sent_at,
        c.created_by_membership_id::text,
        c.created_at,
        c.updated_at
      from whatsapp_campaigns c
      left join batches b on b.id = c.audience_batch_id and b.tenant_id = c.tenant_id
      left join whatsapp_templates t on t.id = c.template_id and t.tenant_id = c.tenant_id
      where (${status}::text is null or c.status = ${status})
        and (${q} = '' or c.title ilike '%' || ${q} || '%')
        and (${createdOn}::text is null or c.created_at::date = ${createdOn}::date)
      order by c.created_at desc
      limit ${args.limit}
    `;
  },

  async findCampaign(tx: TenantTx, id: string): Promise<WhatsappCampaignRow | null> {
    const rows = await tx.$queryRaw<WhatsappCampaignRow[]>`
      select
        c.id::text,
        c.title,
        c.status,
        c.audience_type,
        c.audience_batch_id::text,
        b.name as audience_batch_name,
        c.template_id::text,
        t.name as template_name,
        t.body as template_body,
        t.language as template_language,
        t.status as template_status,
        c.recipient_count,
        c.delivered_count,
        c.failed_count,
        c.scheduled_at,
        c.sent_at,
        c.created_by_membership_id::text,
        c.created_at,
        c.updated_at
      from whatsapp_campaigns c
      left join batches b on b.id = c.audience_batch_id and b.tenant_id = c.tenant_id
      left join whatsapp_templates t on t.id = c.template_id and t.tenant_id = c.tenant_id
      where c.id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertCampaign(
    tx: TenantTx,
    args: { title: string; createdByMembershipId: string },
  ): Promise<string> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into whatsapp_campaigns (
        id, tenant_id, title, status, created_by_membership_id, created_at, updated_at
      ) values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.title},
        'DRAFT',
        ${args.createdByMembershipId}::uuid,
        now(),
        now()
      )
    `;
    return id;
  },

  async updateCampaignTitle(tx: TenantTx, id: string, title: string): Promise<void> {
    await tx.$executeRaw`
      update whatsapp_campaigns set title = ${title}, updated_at = now() where id = ${id}::uuid
    `;
  },

  async updateCampaignAudience(
    tx: TenantTx,
    args: {
      id: string;
      audienceType: string;
      audienceBatchId: string | null;
      recipientCount: number;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      update whatsapp_campaigns
      set
        audience_type = ${args.audienceType},
        audience_batch_id = ${args.audienceBatchId}::uuid,
        recipient_count = ${args.recipientCount},
        updated_at = now()
      where id = ${args.id}::uuid and status = 'DRAFT'
    `;
  },

  async updateCampaignTemplate(tx: TenantTx, id: string, templateId: string): Promise<void> {
    await tx.$executeRaw`
      update whatsapp_campaigns
      set template_id = ${templateId}::uuid, updated_at = now()
      where id = ${id}::uuid and status in ('DRAFT', 'SCHEDULED')
    `;
  },

  async markCampaignScheduled(tx: TenantTx, id: string, scheduledAt: Date): Promise<void> {
    await tx.$executeRaw`
      update whatsapp_campaigns
      set status = 'SCHEDULED', scheduled_at = ${scheduledAt}, updated_at = now()
      where id = ${id}::uuid and status in ('DRAFT', 'SCHEDULED')
    `;
  },

  async markCampaignSent(
    tx: TenantTx,
    id: string,
    args: { recipientCount: number; deliveredCount: number; failedCount: number },
  ): Promise<void> {
    await tx.$executeRaw`
      update whatsapp_campaigns
      set
        status = 'SENT',
        sent_at = now(),
        scheduled_at = null,
        recipient_count = ${args.recipientCount},
        delivered_count = ${args.deliveredCount},
        failed_count = ${args.failedCount},
        updated_at = now()
      where id = ${id}::uuid
    `;
  },

  async deleteCampaign(tx: TenantTx, id: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      delete from whatsapp_campaigns where id = ${id}::uuid returning id::text
    `;
    return rows.length > 0;
  },

  async listDueScheduled(tx: TenantTx): Promise<WhatsappCampaignRow[]> {
    return tx.$queryRaw<WhatsappCampaignRow[]>`
      select
        c.id::text,
        c.title,
        c.status,
        c.audience_type,
        c.audience_batch_id::text,
        b.name as audience_batch_name,
        c.template_id::text,
        t.name as template_name,
        t.body as template_body,
        t.language as template_language,
        t.status as template_status,
        c.recipient_count,
        c.delivered_count,
        c.failed_count,
        c.scheduled_at,
        c.sent_at,
        c.created_by_membership_id::text,
        c.created_at,
        c.updated_at
      from whatsapp_campaigns c
      left join batches b on b.id = c.audience_batch_id and b.tenant_id = c.tenant_id
      left join whatsapp_templates t on t.id = c.template_id and t.tenant_id = c.tenant_id
      where c.status = 'SCHEDULED'
        and c.scheduled_at is not null
        and c.scheduled_at <= now()
      order by c.scheduled_at asc
      limit 20
    `;
  },

  async batchExists(tx: TenantTx, batchId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text from batches where id = ${batchId}::uuid limit 1
    `;
    return rows.length > 0;
  },

  async previewRecipients(
    tx: TenantTx,
    args: { audienceType: string; audienceBatchId: string | null; limit?: number },
  ): Promise<{ totalCount: number; withPhoneCount: number; items: WhatsappRecipient[] }> {
    const limit = args.limit ?? 100;

    if (args.audienceType === "GROUP" && args.audienceBatchId) {
      const allCount = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from batch_memberships bm
        join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
        where bm.batch_id = ${args.audienceBatchId}::uuid
          and m.status = 'ACTIVE' and m.archived_at is null
      `;
      const phoneCountRows = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from batch_memberships bm
        join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        where bm.batch_id = ${args.audienceBatchId}::uuid
          and m.status = 'ACTIVE' and m.archived_at is null
          and coalesce(
            nullif(mp.metadata_json->>'phone', ''),
            nullif(mp.metadata_json->>'mobile', ''),
            nullif(mp.metadata_json->>'whatsapp', '')
          ) is not null
      `;
      const items = await tx.$queryRaw<WhatsappRecipient[]>`
        select
          m.id::text as membership_id,
          mp.display_name,
          ap.email,
          coalesce(
            nullif(mp.metadata_json->>'phone', ''),
            nullif(mp.metadata_json->>'mobile', ''),
            nullif(mp.metadata_json->>'whatsapp', '')
          ) as phone
        from batch_memberships bm
        join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where bm.batch_id = ${args.audienceBatchId}::uuid
          and m.status = 'ACTIVE'
          and m.archived_at is null
        order by coalesce(mp.display_name, ap.email, m.id::text) asc
        limit ${limit}
      `;
      return {
        totalCount: Number(allCount[0]?.count ?? 0),
        withPhoneCount: Number(phoneCountRows[0]?.count ?? 0),
        items,
      };
    }

    const allCount = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from memberships
      where status = 'ACTIVE' and archived_at is null
    `;
    const phoneCountRows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      where m.status = 'ACTIVE' and m.archived_at is null
        and coalesce(
          nullif(mp.metadata_json->>'phone', ''),
          nullif(mp.metadata_json->>'mobile', ''),
          nullif(mp.metadata_json->>'whatsapp', '')
        ) is not null
    `;
    const items = await tx.$queryRaw<WhatsappRecipient[]>`
      select
        m.id::text as membership_id,
        mp.display_name,
        ap.email,
        coalesce(
          nullif(mp.metadata_json->>'phone', ''),
          nullif(mp.metadata_json->>'mobile', ''),
          nullif(mp.metadata_json->>'whatsapp', '')
        ) as phone
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.status = 'ACTIVE' and m.archived_at is null
      order by coalesce(mp.display_name, ap.email, m.id::text) asc
      limit ${limit}
    `;
    return {
      totalCount: Number(allCount[0]?.count ?? 0),
      withPhoneCount: Number(phoneCountRows[0]?.count ?? 0),
      items,
    };
  },

  async listRecipientPhones(
    tx: TenantTx,
    args: { audienceType: string; audienceBatchId: string | null; limit?: number },
  ): Promise<WhatsappRecipient[]> {
    const limit = args.limit ?? 2000;
    if (args.audienceType === "GROUP" && args.audienceBatchId) {
      return tx.$queryRaw<WhatsappRecipient[]>`
        select
          m.id::text as membership_id,
          mp.display_name,
          ap.email,
          coalesce(
            nullif(mp.metadata_json->>'phone', ''),
            nullif(mp.metadata_json->>'mobile', ''),
            nullif(mp.metadata_json->>'whatsapp', '')
          ) as phone
        from batch_memberships bm
        join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where bm.batch_id = ${args.audienceBatchId}::uuid
          and m.status = 'ACTIVE' and m.archived_at is null
        order by bm.joined_at desc
        limit ${limit}
      `;
    }
    return tx.$queryRaw<WhatsappRecipient[]>`
      select
        m.id::text as membership_id,
        mp.display_name,
        ap.email,
        coalesce(
          nullif(mp.metadata_json->>'phone', ''),
          nullif(mp.metadata_json->>'mobile', ''),
          nullif(mp.metadata_json->>'whatsapp', '')
        ) as phone
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.status = 'ACTIVE' and m.archived_at is null
      order by m.created_at desc
      limit ${limit}
    `;
  },

  async listConversations(tx: TenantTx): Promise<WhatsappConversationRow[]> {
    return tx.$queryRaw<WhatsappConversationRow[]>`
      select
        c.id::text,
        c.wa_phone,
        c.membership_id::text,
        c.learner_name,
        c.last_message_at,
        c.unread_count,
        (
          select m.body from whatsapp_inbox_messages m
          where m.conversation_id = c.id
          order by m.created_at desc
          limit 1
        ) as last_message_preview
      from whatsapp_conversations c
      order by c.last_message_at desc
      limit 100
    `;
  },

  async findConversation(tx: TenantTx, id: string): Promise<WhatsappConversationRow | null> {
    const rows = await tx.$queryRaw<WhatsappConversationRow[]>`
      select
        c.id::text,
        c.wa_phone,
        c.membership_id::text,
        c.learner_name,
        c.last_message_at,
        c.unread_count,
        null::text as last_message_preview
      from whatsapp_conversations c
      where c.id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findConversationByPhone(
    tx: TenantTx,
    waPhone: string,
  ): Promise<WhatsappConversationRow | null> {
    const rows = await tx.$queryRaw<WhatsappConversationRow[]>`
      select
        c.id::text,
        c.wa_phone,
        c.membership_id::text,
        c.learner_name,
        c.last_message_at,
        c.unread_count,
        null::text as last_message_preview
      from whatsapp_conversations c
      where c.wa_phone = ${waPhone}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async upsertConversation(
    tx: TenantTx,
    args: {
      waPhone: string;
      membershipId: string | null;
      learnerName: string | null;
      incrementUnread: boolean;
    },
  ): Promise<string> {
    const existing = await this.findConversationByPhone(tx, args.waPhone);
    if (existing) {
      await tx.$executeRaw`
        update whatsapp_conversations
        set
          learner_name = coalesce(${args.learnerName}, learner_name),
          membership_id = coalesce(${args.membershipId}::uuid, membership_id),
          last_message_at = now(),
          unread_count = unread_count + ${args.incrementUnread ? 1 : 0},
          updated_at = now()
        where id = ${existing.id}::uuid
      `;
      return existing.id;
    }
    const id = randomUUID();
    await tx.$executeRaw`
      insert into whatsapp_conversations (
        id, tenant_id, wa_phone, membership_id, learner_name,
        last_message_at, unread_count, created_at, updated_at
      ) values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.waPhone},
        ${args.membershipId}::uuid,
        ${args.learnerName},
        now(),
        ${args.incrementUnread ? 1 : 0},
        now(),
        now()
      )
    `;
    return id;
  },

  async listInboxMessages(
    tx: TenantTx,
    conversationId: string,
  ): Promise<WhatsappInboxMessageRow[]> {
    return tx.$queryRaw<WhatsappInboxMessageRow[]>`
      select id::text, direction, body, status, created_at
      from whatsapp_inbox_messages
      where conversation_id = ${conversationId}::uuid
      order by created_at asc
      limit 500
    `;
  },

  async insertInboxMessage(
    tx: TenantTx,
    args: {
      conversationId: string;
      direction: string;
      body: string;
      status: string;
      metaMessageId: string | null;
    },
  ): Promise<string> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into whatsapp_inbox_messages (
        id, tenant_id, conversation_id, direction, body, status, meta_message_id, created_at
      ) values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.conversationId}::uuid,
        ${args.direction},
        ${args.body},
        ${args.status},
        ${args.metaMessageId},
        now()
      )
    `;
    return id;
  },

  async markConversationRead(tx: TenantTx, conversationId: string): Promise<void> {
    await tx.$executeRaw`
      update whatsapp_conversations
      set unread_count = 0, updated_at = now()
      where id = ${conversationId}::uuid
    `;
  },
};
