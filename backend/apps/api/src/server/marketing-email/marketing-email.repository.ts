import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type MarketingEmailCampaignRow = {
  id: string;
  title: string;
  status: string;
  audience_type: string | null;
  audience_batch_id: string | null;
  audience_batch_name: string | null;
  subject: string | null;
  body_html: string | null;
  template_key: string | null;
  recipient_count: number;
  scheduled_at: Date | null;
  sent_at: Date | null;
  created_by_membership_id: string;
  created_at: Date;
  updated_at: Date;
};

export type MarketingEmailRecipientPreview = {
  membership_id: string;
  display_name: string | null;
  email: string | null;
};

export const marketingEmailRepository = {
  async list(
    tx: TenantTx,
    args: {
      status?: string;
      q?: string;
      createdOn?: string;
      limit: number;
      offset?: number;
    },
  ): Promise<MarketingEmailCampaignRow[]> {
    const status = args.status && args.status !== "ALL" ? args.status : null;
    const q = args.q?.trim() ?? "";
    const createdOn = args.createdOn ?? null;
    const offset = args.offset ?? 0;

    return tx.$queryRaw<MarketingEmailCampaignRow[]>`
      select
        mec.id::text,
        mec.title,
        mec.status,
        mec.audience_type,
        mec.audience_batch_id::text,
        b.name as audience_batch_name,
        mec.subject,
        mec.body_html,
        mec.template_key,
        mec.recipient_count,
        mec.scheduled_at,
        mec.sent_at,
        mec.created_by_membership_id::text,
        mec.created_at,
        mec.updated_at
      from marketing_email_campaigns mec
      left join batches b
        on b.id = mec.audience_batch_id
       and b.tenant_id = mec.tenant_id
      where (
        ${status}::text is null or mec.status = ${status}
      )
      and (
        ${q} = ''
        or mec.title ilike '%' || ${q} || '%'
        or coalesce(mec.subject, '') ilike '%' || ${q} || '%'
      )
      and (
        ${createdOn}::text is null
        or mec.created_at::date = ${createdOn}::date
      )
      order by mec.created_at desc
      limit ${args.limit}
      offset ${offset}
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
      from marketing_email_campaigns mec
      where (
        ${status}::text is null or mec.status = ${status}
      )
      and (
        ${q} = ''
        or mec.title ilike '%' || ${q} || '%'
        or coalesce(mec.subject, '') ilike '%' || ${q} || '%'
      )
      and (
        ${createdOn}::text is null
        or mec.created_at::date = ${createdOn}::date
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
    campaign_count: number;
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        draft_count: number;
        scheduled_count: number;
        sent_count: number;
        total_reach: number;
        reach_30d: number;
        reach_prev_30d: number;
        campaign_count: number;
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
        count(*)::int as campaign_count
      from marketing_email_campaigns
    `;
    return (
      rows[0] ?? {
        draft_count: 0,
        scheduled_count: 0,
        sent_count: 0,
        total_reach: 0,
        reach_30d: 0,
        reach_prev_30d: 0,
        campaign_count: 0,
      }
    );
  },

  async findById(tx: TenantTx, id: string): Promise<MarketingEmailCampaignRow | null> {
    const rows = await tx.$queryRaw<MarketingEmailCampaignRow[]>`
      select
        mec.id::text,
        mec.title,
        mec.status,
        mec.audience_type,
        mec.audience_batch_id::text,
        b.name as audience_batch_name,
        mec.subject,
        mec.body_html,
        mec.template_key,
        mec.recipient_count,
        mec.scheduled_at,
        mec.sent_at,
        mec.created_by_membership_id::text,
        mec.created_at,
        mec.updated_at
      from marketing_email_campaigns mec
      left join batches b
        on b.id = mec.audience_batch_id
       and b.tenant_id = mec.tenant_id
      where mec.id = ${id}::uuid
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
      insert into marketing_email_campaigns (
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
      update marketing_email_campaigns
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
      update marketing_email_campaigns
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
      bodyHtml: string;
      templateKey: string | null;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      update marketing_email_campaigns
      set
        subject = ${args.subject},
        body_html = ${args.bodyHtml},
        template_key = ${args.templateKey},
        updated_at = now()
      where id = ${args.id}::uuid
        and status in ('DRAFT', 'SCHEDULED')
    `;
  },

  async markScheduled(tx: TenantTx, id: string, scheduledAt: Date): Promise<void> {
    await tx.$executeRaw`
      update marketing_email_campaigns
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
      update marketing_email_campaigns
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
      delete from marketing_email_campaigns where id = ${id}::uuid returning id::text
    `;
    return rows.length > 0;
  },

  async listDueScheduled(tx: TenantTx): Promise<MarketingEmailCampaignRow[]> {
    return tx.$queryRaw<MarketingEmailCampaignRow[]>`
      select
        mec.id::text,
        mec.title,
        mec.status,
        mec.audience_type,
        mec.audience_batch_id::text,
        b.name as audience_batch_name,
        mec.subject,
        mec.body_html,
        mec.template_key,
        mec.recipient_count,
        mec.scheduled_at,
        mec.sent_at,
        mec.created_by_membership_id::text,
        mec.created_at,
        mec.updated_at
      from marketing_email_campaigns mec
      left join batches b
        on b.id = mec.audience_batch_id
       and b.tenant_id = mec.tenant_id
      where mec.status = 'SCHEDULED'
        and mec.scheduled_at is not null
        and mec.scheduled_at <= now()
      order by mec.scheduled_at asc
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
  ): Promise<{ totalCount: number; items: MarketingEmailRecipientPreview[] }> {
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
      const items = await tx.$queryRaw<MarketingEmailRecipientPreview[]>`
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
    const items = await tx.$queryRaw<MarketingEmailRecipientPreview[]>`
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

  async listRecipientDeliveryTargets(
    tx: TenantTx,
    membershipIds: string[],
  ): Promise<Array<{ membershipId: string; email: string; displayName: string | null }>> {
    if (membershipIds.length === 0) return [];
    const rows = await tx.$queryRaw<
      Array<{ membership_id: string; email: string | null; display_name: string | null }>
    >`
      select
        m.id::text as membership_id,
        ap.email,
        mp.display_name
      from memberships m
      join auth_principals ap on ap.id = m.auth_principal_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      where m.id = any(${membershipIds}::uuid[])
        and m.status = 'ACTIVE'
        and m.archived_at is null
    `;
    return rows
      .filter((row): row is typeof row & { email: string } => Boolean(row.email?.trim()))
      .map((row) => ({
        membershipId: row.membership_id,
        email: row.email.trim(),
        displayName: row.display_name,
      }));
  },
};
