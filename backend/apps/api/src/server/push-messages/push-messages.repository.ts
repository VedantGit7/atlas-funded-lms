import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type PushMessageRow = {
  id: string;
  title: string;
  status: string;
  audience_type: string | null;
  audience_batch_id: string | null;
  audience_batch_name: string | null;
  subject: string | null;
  body: string | null;
  deep_link: string | null;
  image_url: string | null;
  channel_android: boolean;
  channel_ios: boolean;
  channel_web: boolean;
  recipient_count: number;
  scheduled_at: Date | null;
  sent_at: Date | null;
  created_by_membership_id: string;
  created_at: Date;
  updated_at: Date;
};

export type PushRecipientPreview = {
  membership_id: string;
  display_name: string | null;
  email: string | null;
};

export const pushMessagesRepository = {
  async list(
    tx: TenantTx,
    args: {
      status?: string;
      q?: string;
      createdOn?: string;
      limit: number;
      offset?: number;
    },
  ): Promise<PushMessageRow[]> {
    const status = args.status && args.status !== "ALL" ? args.status : null;
    const q = args.q?.trim() ?? "";
    const createdOn = args.createdOn ?? null;

    return tx.$queryRaw<PushMessageRow[]>`
      select
        pm.id::text,
        pm.title,
        pm.status,
        pm.audience_type,
        pm.audience_batch_id::text,
        b.name as audience_batch_name,
        pm.subject,
        pm.body,
        pm.deep_link,
        pm.image_url,
        pm.channel_android,
        pm.channel_ios,
        pm.channel_web,
        pm.recipient_count,
        pm.scheduled_at,
        pm.sent_at,
        pm.created_by_membership_id::text,
        pm.created_at,
        pm.updated_at
      from push_messages pm
      left join batches b
        on b.id = pm.audience_batch_id
       and b.tenant_id = pm.tenant_id
      where (
        ${status}::text is null or pm.status = ${status}
      )
      and (
        ${q} = ''
        or pm.title ilike '%' || ${q} || '%'
        or coalesce(pm.subject, '') ilike '%' || ${q} || '%'
      )
      and (
        ${createdOn}::text is null
        or pm.created_at::date = ${createdOn}::date
      )
      order by pm.created_at desc
      limit ${args.limit}
      offset ${args.offset ?? 0}
    `;
  },

  async count(
    tx: TenantTx,
    args: { status?: string; q?: string; createdOn?: string },
  ): Promise<number> {
    const status = args.status && args.status !== "ALL" ? args.status : null;
    const q = args.q?.trim() ?? "";
    const createdOn = args.createdOn ?? null;

    const rows = await tx.$queryRaw<Array<{ total: number }>>`
      select count(*)::int as total
      from push_messages pm
      where (
        ${status}::text is null or pm.status = ${status}
      )
      and (
        ${q} = ''
        or pm.title ilike '%' || ${q} || '%'
        or coalesce(pm.subject, '') ilike '%' || ${q} || '%'
      )
      and (
        ${createdOn}::text is null
        or pm.created_at::date = ${createdOn}::date
      )
    `;
    return rows[0]?.total ?? 0;
  },

  async summary(tx: TenantTx): Promise<{
    draft_count: number;
    scheduled_count: number;
    sent_count: number;
    total_reach: number;
    reach_30d: number;
    reach_prev_30d: number;
    android_enabled_count: number;
    ios_enabled_count: number;
    web_enabled_count: number;
    message_count: number;
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        draft_count: number;
        scheduled_count: number;
        sent_count: number;
        total_reach: number;
        reach_30d: number;
        reach_prev_30d: number;
        android_enabled_count: number;
        ios_enabled_count: number;
        web_enabled_count: number;
        message_count: number;
      }>
    >`
      select
        count(*) filter (where status = 'DRAFT')::int as draft_count,
        count(*) filter (where status = 'SCHEDULED')::int as scheduled_count,
        count(*) filter (where status = 'SENT')::int as sent_count,
        coalesce(sum(recipient_count) filter (where status = 'SENT'), 0)::int as total_reach,
        coalesce(
          sum(recipient_count) filter (
            where status = 'SENT'
              and sent_at >= (current_timestamp - interval '30 days')
          ),
          0
        )::int as reach_30d,
        coalesce(
          sum(recipient_count) filter (
            where status = 'SENT'
              and sent_at >= (current_timestamp - interval '60 days')
              and sent_at < (current_timestamp - interval '30 days')
          ),
          0
        )::int as reach_prev_30d,
        count(*) filter (where channel_android = true)::int as android_enabled_count,
        count(*) filter (where channel_ios = true)::int as ios_enabled_count,
        count(*) filter (where channel_web = true)::int as web_enabled_count,
        count(*)::int as message_count
      from push_messages
    `;
    return (
      rows[0] ?? {
        draft_count: 0,
        scheduled_count: 0,
        sent_count: 0,
        total_reach: 0,
        reach_30d: 0,
        reach_prev_30d: 0,
        android_enabled_count: 0,
        ios_enabled_count: 0,
        web_enabled_count: 0,
        message_count: 0,
      }
    );
  },

  async findById(tx: TenantTx, id: string): Promise<PushMessageRow | null> {
    const rows = await tx.$queryRaw<PushMessageRow[]>`
      select
        pm.id::text,
        pm.title,
        pm.status,
        pm.audience_type,
        pm.audience_batch_id::text,
        b.name as audience_batch_name,
        pm.subject,
        pm.body,
        pm.deep_link,
        pm.image_url,
        pm.channel_android,
        pm.channel_ios,
        pm.channel_web,
        pm.recipient_count,
        pm.scheduled_at,
        pm.sent_at,
        pm.created_by_membership_id::text,
        pm.created_at,
        pm.updated_at
      from push_messages pm
      left join batches b
        on b.id = pm.audience_batch_id
       and b.tenant_id = pm.tenant_id
      where pm.id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertDraft(
    tx: TenantTx,
    args: { title: string; createdByMembershipId: string },
  ): Promise<string> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into push_messages (
        id, tenant_id, title, status, created_by_membership_id, created_at, updated_at
      )
      values (
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

  async updateTitle(tx: TenantTx, id: string, title: string): Promise<void> {
    await tx.$executeRaw`
      update push_messages
      set title = ${title}, updated_at = now()
      where id = ${id}::uuid
    `;
  },

  async updateAudience(
    tx: TenantTx,
    args: {
      id: string;
      audienceType: string;
      audienceBatchId: string | null;
      recipientCount: number;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      update push_messages
      set
        audience_type = ${args.audienceType},
        audience_batch_id = ${args.audienceBatchId}::uuid,
        recipient_count = ${args.recipientCount},
        updated_at = now()
      where id = ${args.id}::uuid
        and status = 'DRAFT'
    `;
  },

  async updateCompose(
    tx: TenantTx,
    args: {
      id: string;
      subject: string;
      body: string;
      deepLink: string | null;
      imageUrl: string | null;
      channelAndroid: boolean;
      channelIos: boolean;
      channelWeb: boolean;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      update push_messages
      set
        subject = ${args.subject},
        body = ${args.body},
        deep_link = ${args.deepLink},
        image_url = ${args.imageUrl},
        channel_android = ${args.channelAndroid},
        channel_ios = ${args.channelIos},
        channel_web = ${args.channelWeb},
        updated_at = now()
      where id = ${args.id}::uuid
        and status in ('DRAFT', 'SCHEDULED')
    `;
  },

  async markScheduled(tx: TenantTx, id: string, scheduledAt: Date): Promise<void> {
    await tx.$executeRaw`
      update push_messages
      set
        status = 'SCHEDULED',
        scheduled_at = ${scheduledAt},
        updated_at = now()
      where id = ${id}::uuid
        and status in ('DRAFT', 'SCHEDULED')
    `;
  },

  async markSent(tx: TenantTx, id: string, recipientCount: number): Promise<void> {
    await tx.$executeRaw`
      update push_messages
      set
        status = 'SENT',
        sent_at = now(),
        scheduled_at = null,
        recipient_count = ${recipientCount},
        updated_at = now()
      where id = ${id}::uuid
    `;
  },

  async deleteById(tx: TenantTx, id: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      delete from push_messages where id = ${id}::uuid returning id::text
    `;
    return rows.length > 0;
  },

  async listDueScheduled(tx: TenantTx): Promise<PushMessageRow[]> {
    return tx.$queryRaw<PushMessageRow[]>`
      select
        pm.id::text,
        pm.title,
        pm.status,
        pm.audience_type,
        pm.audience_batch_id::text,
        b.name as audience_batch_name,
        pm.subject,
        pm.body,
        pm.deep_link,
        pm.image_url,
        pm.channel_android,
        pm.channel_ios,
        pm.channel_web,
        pm.recipient_count,
        pm.scheduled_at,
        pm.sent_at,
        pm.created_by_membership_id::text,
        pm.created_at,
        pm.updated_at
      from push_messages pm
      left join batches b
        on b.id = pm.audience_batch_id
       and b.tenant_id = pm.tenant_id
      where pm.status = 'SCHEDULED'
        and pm.scheduled_at is not null
        and pm.scheduled_at <= now()
      order by pm.scheduled_at asc
      limit 20
    `;
  },

  async listActiveMembershipIds(tx: TenantTx, limit = 2000): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from memberships
      where status = 'ACTIVE'
        and archived_at is null
      order by created_at desc
      limit ${limit}
    `;
    return rows.map((row) => row.id);
  },

  async listBatchMembershipIds(tx: TenantTx, batchId: string, limit = 2000): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select bm.membership_id::text
      from batch_memberships bm
      join memberships m
        on m.id = bm.membership_id
       and m.tenant_id = bm.tenant_id
      where bm.batch_id = ${batchId}::uuid
        and m.status = 'ACTIVE'
        and m.archived_at is null
      order by bm.joined_at desc
      limit ${limit}
    `;
    return rows.map((row) => row.membership_id);
  },

  async previewRecipients(
    tx: TenantTx,
    args: { audienceType: string; audienceBatchId: string | null; limit?: number },
  ): Promise<{ totalCount: number; items: PushRecipientPreview[] }> {
    const limit = args.limit ?? 50;
    if (args.audienceType === "GROUP" && args.audienceBatchId) {
      const countRows = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from batch_memberships bm
        join memberships m
          on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
        where bm.batch_id = ${args.audienceBatchId}::uuid
          and m.status = 'ACTIVE'
          and m.archived_at is null
      `;
      const items = await tx.$queryRaw<PushRecipientPreview[]>`
        select
          m.id::text as membership_id,
          mp.display_name,
          ap.email
        from batch_memberships bm
        join memberships m
          on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap
          on ap.id = m.auth_principal_id
        where bm.batch_id = ${args.audienceBatchId}::uuid
          and m.status = 'ACTIVE'
          and m.archived_at is null
        order by coalesce(mp.display_name, ap.email, m.id::text) asc
        limit ${limit}
      `;
      return { totalCount: Number(countRows[0]?.count ?? 0), items };
    }

    const countRows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from memberships
      where status = 'ACTIVE'
        and archived_at is null
    `;
    const items = await tx.$queryRaw<PushRecipientPreview[]>`
      select
        m.id::text as membership_id,
        mp.display_name,
        ap.email
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap
        on ap.id = m.auth_principal_id
      where m.status = 'ACTIVE'
        and m.archived_at is null
      order by coalesce(mp.display_name, ap.email, m.id::text) asc
      limit ${limit}
    `;
    return { totalCount: Number(countRows[0]?.count ?? 0), items };
  },

  async batchExists(tx: TenantTx, batchId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text from batches where id = ${batchId}::uuid limit 1
    `;
    return rows.length > 0;
  },
};
