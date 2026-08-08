import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { z } from "zod";
import type {
  campaignChannelsSchema,
  campaignTouchpointSchema,
} from "./marketing-campaigns.schemas";

export type CampaignChannels = z.infer<typeof campaignChannelsSchema>;
export type CampaignTouchpoint = z.infer<typeof campaignTouchpointSchema>;

export type MarketingCampaignRow = {
  id: string;
  title: string;
  goal: string | null;
  status: string;
  audience_type: string | null;
  audience_batch_id: string | null;
  audience_label: string | null;
  recipient_count: number;
  channels_json: unknown;
  touchpoints_json: unknown;
  launched_at: Date | null;
  scheduled_at: Date | null;
  created_by_membership_id: string;
  created_at: Date;
  updated_at: Date;
};

export type CampaignSummaryRow = {
  draft_count: number;
  scheduled_count: number;
  sent_count: number;
  total_count: number;
  total_reach: number;
};

function asJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

export const marketingCampaignsRepository = {
  async list(
    tx: TenantTx,
    args: { status?: string; q?: string; limit: number; offset: number },
  ): Promise<MarketingCampaignRow[]> {
    const status = args.status && args.status !== "ALL" ? args.status : null;
    const q = args.q?.trim() ? `%${args.q.trim()}%` : null;
    return tx.$queryRawUnsafe<MarketingCampaignRow[]>(
      `
      select
        c.id::text,
        c.title,
        c.goal,
        c.status,
        c.audience_type,
        c.audience_batch_id::text,
        b.name as audience_label,
        c.recipient_count,
        c.channels_json,
        c.touchpoints_json,
        c.launched_at,
        c.scheduled_at,
        c.created_by_membership_id::text,
        c.created_at,
        c.updated_at
      from marketing_campaigns c
      left join batches b on b.id = c.audience_batch_id
      where ($1::text is null or c.status = $1)
        and ($2::text is null or c.title ilike $2)
      order by c.updated_at desc
      limit $3 offset $4
      `,
      status,
      q,
      args.limit,
      args.offset,
    );
  },

  async summary(tx: TenantTx): Promise<CampaignSummaryRow> {
    const rows = await tx.$queryRawUnsafe<CampaignSummaryRow[]>(
      `
      select
        count(*) filter (where status = 'DRAFT')::int as draft_count,
        count(*) filter (where status = 'SCHEDULED')::int as scheduled_count,
        count(*) filter (where status = 'SENT')::int as sent_count,
        count(*)::int as total_count,
        coalesce(sum(recipient_count) filter (where status in ('SENT', 'SCHEDULED')), 0)::int as total_reach
      from marketing_campaigns
      `,
    );
    return (
      rows[0] ?? {
        draft_count: 0,
        scheduled_count: 0,
        sent_count: 0,
        total_count: 0,
        total_reach: 0,
      }
    );
  },

  async findById(tx: TenantTx, id: string): Promise<MarketingCampaignRow | null> {
    const rows = await tx.$queryRawUnsafe<MarketingCampaignRow[]>(
      `
      select
        c.id::text,
        c.title,
        c.goal,
        c.status,
        c.audience_type,
        c.audience_batch_id::text,
        b.name as audience_label,
        c.recipient_count,
        c.channels_json,
        c.touchpoints_json,
        c.launched_at,
        c.scheduled_at,
        c.created_by_membership_id::text,
        c.created_at,
        c.updated_at
      from marketing_campaigns c
      left join batches b on b.id = c.audience_batch_id
      where c.id = $1::uuid
      limit 1
      `,
      id,
    );
    return rows[0] ?? null;
  },

  async insertDraft(
    tx: TenantTx,
    args: {
      title: string;
      goal: string | null;
      createdByMembershipId: string;
    },
  ): Promise<string> {
    const id = randomUUID();
    await tx.$executeRawUnsafe(
      `
      insert into marketing_campaigns (
        id, tenant_id, title, goal, status,
        channels_json, touchpoints_json,
        created_by_membership_id
      ) values (
        $1::uuid, app.current_tenant_id(), $2, $3, 'DRAFT',
        '{}'::jsonb, '[]'::jsonb,
        $4::uuid
      )
      `,
      id,
      args.title,
      args.goal,
      args.createdByMembershipId,
    );
    return id;
  },

  async updateIdentity(
    tx: TenantTx,
    id: string,
    args: { title: string; goal: string },
  ) {
    await tx.$executeRawUnsafe(
      `
      update marketing_campaigns
      set title = $2, goal = $3, updated_at = now()
      where id = $1::uuid
      `,
      id,
      args.title,
      args.goal,
    );
  },

  async updateAudience(
    tx: TenantTx,
    id: string,
    args: {
      audienceType: string;
      audienceBatchId: string | null;
      recipientCount: number;
    },
  ) {
    await tx.$executeRawUnsafe(
      `
      update marketing_campaigns
      set
        audience_type = $2,
        audience_batch_id = $3::uuid,
        recipient_count = $4,
        updated_at = now()
      where id = $1::uuid
      `,
      id,
      args.audienceType,
      args.audienceBatchId,
      args.recipientCount,
    );
  },

  async updateTouchpoints(
    tx: TenantTx,
    id: string,
    args: { channels: CampaignChannels; touchpoints: CampaignTouchpoint[] },
  ) {
    await tx.$executeRawUnsafe(
      `
      update marketing_campaigns
      set
        channels_json = $2::jsonb,
        touchpoints_json = $3::jsonb,
        updated_at = now()
      where id = $1::uuid
      `,
      id,
      asJson(args.channels),
      asJson(args.touchpoints),
    );
  },

  async markLaunched(
    tx: TenantTx,
    id: string,
    args: {
      status: string;
      touchpoints: CampaignTouchpoint[];
      launchedAt: Date;
      scheduledAt: Date | null;
      recipientCount: number;
    },
  ) {
    await tx.$executeRawUnsafe(
      `
      update marketing_campaigns
      set
        status = $2,
        touchpoints_json = $3::jsonb,
        launched_at = $4,
        scheduled_at = $5,
        recipient_count = $6,
        updated_at = now()
      where id = $1::uuid
      `,
      id,
      args.status,
      asJson(args.touchpoints),
      args.launchedAt,
      args.scheduledAt,
      args.recipientCount,
    );
  },

  async delete(tx: TenantTx, id: string) {
    await tx.$executeRawUnsafe(
      `delete from marketing_campaigns where id = $1::uuid`,
      id,
    );
  },

  async batchExists(tx: TenantTx, batchId: string): Promise<boolean> {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `select id::text from batches where id = $1::uuid limit 1`,
      batchId,
    );
    return rows.length > 0;
  },

  async previewRecipients(
    tx: TenantTx,
    args: { audienceType: string; audienceBatchId: string | null },
  ): Promise<{ totalCount: number }> {
    if (args.audienceType === "GROUP" && args.audienceBatchId) {
      const rows = await tx.$queryRawUnsafe<Array<{ total: bigint }>>(
        `
        select count(*)::bigint as total
        from batch_memberships bm
        join memberships m
          on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
        where bm.batch_id = $1::uuid
          and m.status = 'ACTIVE'
          and m.archived_at is null
        `,
        args.audienceBatchId,
      );
      return { totalCount: Number(rows[0]?.total ?? 0) };
    }

    const all = await tx.$queryRawUnsafe<Array<{ total: bigint }>>(
      `
      select count(*)::bigint as total
      from memberships
      where status = 'ACTIVE'
        and archived_at is null
      `,
    );
    return { totalCount: Number(all[0]?.total ?? 0) };
  },
};