import type { TenantTx } from "@atlas/db";

export type ChannelStatusCounts = {
  draft_count: number;
  scheduled_count: number;
  sent_count: number;
  total_reach: number;
};

export type DailyCountRow = {
  day_offset: number;
  send_count: number;
};

export type ActivityRow = {
  id: string;
  channel: "push" | "email" | "announcements" | "whatsapp";
  kind: "sent" | "scheduled" | "draft";
  title: string;
  detail: string;
  at: Date;
};

export type WebhookSummaryRow = {
  webhook_count: number;
  webhook_enabled_count: number;
  last_delivery_at: Date | null;
  last_delivery_status: string | null;
};

export type CredentialsSummaryRow = {
  api_key_configured: boolean;
};

export type WhatsappConnectionStatusRow = {
  status: string | null;
};

export const messengerHubRepository = {
  async emailCounts(tx: TenantTx): Promise<ChannelStatusCounts> {
    const rows = await tx.$queryRaw<ChannelStatusCounts[]>`
      select
        count(*) filter (where status = 'DRAFT')::int as draft_count,
        count(*) filter (where status = 'SCHEDULED')::int as scheduled_count,
        count(*) filter (where status = 'SENT')::int as sent_count,
        coalesce(sum(recipient_count) filter (where status = 'SENT'), 0)::int as total_reach
      from marketing_email_campaigns
    `;
    return (
      rows[0] ?? {
        draft_count: 0,
        scheduled_count: 0,
        sent_count: 0,
        total_reach: 0,
      }
    );
  },

  async pushCounts(tx: TenantTx): Promise<ChannelStatusCounts> {
    const rows = await tx.$queryRaw<ChannelStatusCounts[]>`
      select
        count(*) filter (where status = 'DRAFT')::int as draft_count,
        count(*) filter (where status = 'SCHEDULED')::int as scheduled_count,
        count(*) filter (where status = 'SENT')::int as sent_count,
        coalesce(sum(recipient_count) filter (where status = 'SENT'), 0)::int as total_reach
      from push_messages
    `;
    return (
      rows[0] ?? {
        draft_count: 0,
        scheduled_count: 0,
        sent_count: 0,
        total_reach: 0,
      }
    );
  },

  async whatsappCounts(tx: TenantTx): Promise<ChannelStatusCounts> {
    const rows = await tx.$queryRaw<ChannelStatusCounts[]>`
      select
        count(*) filter (where status = 'DRAFT')::int as draft_count,
        count(*) filter (where status = 'SCHEDULED')::int as scheduled_count,
        count(*) filter (where status = 'SENT')::int as sent_count,
        coalesce(sum(recipient_count) filter (where status = 'SENT'), 0)::int as total_reach
      from whatsapp_campaigns
    `;
    return (
      rows[0] ?? {
        draft_count: 0,
        scheduled_count: 0,
        sent_count: 0,
        total_reach: 0,
      }
    );
  },

  async announcementCounts(
    tx: TenantTx,
  ): Promise<{ sent_count: number; total_reach: number }> {
    const rows = await tx.$queryRaw<Array<{ sent_count: number; total_reach: number }>>`
      select
        count(*)::int as sent_count,
        coalesce(sum(recipient_count), 0)::int as total_reach
      from announcements
    `;
    return rows[0] ?? { sent_count: 0, total_reach: 0 };
  },

  async emailWeeklySent(tx: TenantTx): Promise<number[]> {
    const rows = await tx.$queryRaw<DailyCountRow[]>`
      with days as (
        select generate_series(0, 6) as day_offset
      )
      select
        d.day_offset::int as day_offset,
        coalesce(count(mec.id), 0)::int as send_count
      from days d
      left join marketing_email_campaigns mec
        on mec.status = 'SENT'
       and mec.sent_at is not null
       and (mec.sent_at::date = (current_date - d.day_offset))
      group by d.day_offset
      order by d.day_offset desc
    `;
    const byOffset = new Map(rows.map((row) => [row.day_offset, row.send_count]));
    return Array.from({ length: 7 }, (_, index) => {
      const dayOffset = 6 - index;
      return byOffset.get(dayOffset) ?? 0;
    });
  },

  async latestEmailTitle(tx: TenantTx): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ title: string }>>`
      select title
      from marketing_email_campaigns
      order by
        case when status = 'SCHEDULED' then 0 when status = 'DRAFT' then 1 else 2 end,
        coalesce(scheduled_at, updated_at) desc
      limit 1
    `;
    return rows[0]?.title ?? null;
  },

  async whatsappConnectionStatus(tx: TenantTx): Promise<"CONNECTED" | "DISCONNECTED"> {
    const rows = await tx.$queryRaw<WhatsappConnectionStatusRow[]>`
      select status
      from whatsapp_connections
      order by updated_at desc
      limit 1
    `;
    return rows[0]?.status === "CONNECTED" ? "CONNECTED" : "DISCONNECTED";
  },

  async webhookSummary(tx: TenantTx): Promise<WebhookSummaryRow> {
    const rows = await tx.$queryRaw<WebhookSummaryRow[]>`
      select
        count(*)::int as webhook_count,
        count(*) filter (where enabled = true)::int as webhook_enabled_count,
        max(last_delivery_at) as last_delivery_at,
        (
          select last_delivery_status
          from marketing_integration_webhooks
          where last_delivery_at is not null
          order by last_delivery_at desc
          limit 1
        ) as last_delivery_status
      from marketing_integration_webhooks
    `;
    return (
      rows[0] ?? {
        webhook_count: 0,
        webhook_enabled_count: 0,
        last_delivery_at: null,
        last_delivery_status: null,
      }
    );
  },

  async credentialsSummary(tx: TenantTx): Promise<boolean> {
    const rows = await tx.$queryRaw<CredentialsSummaryRow[]>`
      select (api_key_hash is not null) as api_key_configured
      from marketing_integration_settings
      limit 1
    `;
    return Boolean(rows[0]?.api_key_configured);
  },

  async recentActivity(tx: TenantTx, limit = 8): Promise<ActivityRow[]> {
    return tx.$queryRaw<ActivityRow[]>`
      (
        select
          mec.id::text as id,
          'email'::text as channel,
          lower(mec.status)::text as kind,
          mec.title as title,
          case
            when mec.status = 'SENT' then 'Sent to ' || mec.recipient_count::text || ' recipients'
            when mec.status = 'SCHEDULED' then 'Scheduled'
            else 'Draft'
          end as detail,
          coalesce(mec.sent_at, mec.scheduled_at, mec.updated_at) as at
        from marketing_email_campaigns mec
        order by coalesce(mec.sent_at, mec.scheduled_at, mec.updated_at) desc
        limit ${limit}
      )
      union all
      (
        select
          pm.id::text as id,
          'push'::text as channel,
          lower(pm.status)::text as kind,
          pm.title as title,
          case
            when pm.status = 'SENT' then 'Sent to ' || pm.recipient_count::text || ' devices'
            when pm.status = 'SCHEDULED' then 'Scheduled'
            else 'Draft'
          end as detail,
          coalesce(pm.sent_at, pm.scheduled_at, pm.updated_at) as at
        from push_messages pm
        order by coalesce(pm.sent_at, pm.scheduled_at, pm.updated_at) desc
        limit ${limit}
      )
      union all
      (
        select
          a.id::text as id,
          'announcements'::text as channel,
          'sent'::text as kind,
          a.title as title,
          'Broadcast to ' || a.recipient_count::text || ' users' as detail,
          coalesce(a.sent_at, a.created_at) as at
        from announcements a
        order by coalesce(a.sent_at, a.created_at) desc
        limit ${limit}
      )
      union all
      (
        select
          c.id::text as id,
          'whatsapp'::text as channel,
          lower(c.status)::text as kind,
          c.title as title,
          case
            when c.status = 'SENT' then 'Delivered to ' || coalesce(c.delivered_count, 0)::text || ' chats'
            when c.status = 'SCHEDULED' then 'Scheduled'
            else 'Draft'
          end as detail,
          coalesce(c.sent_at, c.scheduled_at, c.updated_at) as at
        from whatsapp_campaigns c
        order by coalesce(c.sent_at, c.scheduled_at, c.updated_at) desc
        limit ${limit}
      )
      order by at desc
      limit ${limit}
    `;
  },
};
