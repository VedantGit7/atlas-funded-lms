import type { TenantTx } from "@atlas/db";

export const CUSTOM_FIELD_MESSAGE_TEMPLATE_KEY = "reports.custom-field.message" as const;

export const CUSTOM_FIELD_COHORT_GROUP_SOURCES = [
  "custom_field_report",
  "custom_field_segment",
  "custom_field_segment_snapshot",
] as const;

export type CustomFieldCohortGroupRow = {
  id: string;
  key: string;
  name: string;
  metadata_json: unknown;
  created_at: Date;
  member_count: number;
  created_by_label: string | null;
};

export type CustomFieldCohortCampaignAggRow = {
  campaign_id: string;
  subject: string | null;
  audience_caption: string | null;
  source: string | null;
  segment_id: string | null;
  segment_name: string | null;
  recipient_count: number;
  delivered_count: number;
  failed_count: number;
  skipped_count: number;
  sent_at: Date;
  sent_by_label: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export const customFieldCohortsRepository = {
  asObject,

  async countCohortGroups(tx: TenantTx, q?: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ total: number }>>`
      select count(*)::int as total
      from batches b
      where b.tenant_id = current_setting('app.tenant_id', true)::uuid
        and coalesce(b.metadata_json->>'source', '') = any(array[
          'custom_field_report',
          'custom_field_segment',
          'custom_field_segment_snapshot'
        ]::text[])
        and b.status <> 'ARCHIVED'::"EntityStatus"
        and (
          ${q ?? null}::text is null
          or lower(b.name) like '%' || lower(${q ?? null}) || '%'
          or lower(coalesce(b.metadata_json->>'criteriaSummary', '')) like '%' || lower(${q ?? null}) || '%'
          or lower(coalesce(b.metadata_json->>'segmentName', '')) like '%' || lower(${q ?? null}) || '%'
        )
    `;
    return rows[0]?.total ?? 0;
  },

  async listCohortGroups(
    tx: TenantTx,
    args: { q?: string; limit: number; offset: number },
  ): Promise<CustomFieldCohortGroupRow[]> {
    return tx.$queryRaw<CustomFieldCohortGroupRow[]>`
      select
        b.id::text as id,
        b.key,
        b.name,
        b.metadata_json,
        b.created_at,
        (
          select count(*)::int
          from batch_memberships bm
          where bm.batch_id = b.id
            and bm.tenant_id = b.tenant_id
        ) as member_count,
        null::text as created_by_label
      from batches b
      where b.tenant_id = current_setting('app.tenant_id', true)::uuid
        and coalesce(b.metadata_json->>'source', '') = any(array[
          'custom_field_report',
          'custom_field_segment',
          'custom_field_segment_snapshot'
        ]::text[])
        and b.status <> 'ARCHIVED'::"EntityStatus"
        and (
          ${args.q ?? null}::text is null
          or lower(b.name) like '%' || lower(${args.q ?? null}) || '%'
          or lower(coalesce(b.metadata_json->>'criteriaSummary', '')) like '%' || lower(${args.q ?? null}) || '%'
          or lower(coalesce(b.metadata_json->>'segmentName', '')) like '%' || lower(${args.q ?? null}) || '%'
        )
      order by b.created_at desc
      limit ${args.limit}
      offset ${args.offset}
    `;
  },

  async countCohortCampaigns(tx: TenantTx): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ total: number }>>`
      select count(*)::int as total
      from (
        select coalesce(
          d.payload_json->>'campaignId',
          split_part(d.idempotency_key, ':', 2)
        ) as campaign_id
        from notification_dispatches d
        where d.tenant_id = current_setting('app.tenant_id', true)::uuid
          and d.template_key = ${CUSTOM_FIELD_MESSAGE_TEMPLATE_KEY}
        group by 1
      ) campaigns
      where campaign_id is not null
        and campaign_id <> ''
    `;
    return rows[0]?.total ?? 0;
  },

  async listCohortCampaigns(
    tx: TenantTx,
    args: { limit: number; offset: number },
  ): Promise<CustomFieldCohortCampaignAggRow[]> {
    return tx.$queryRaw<CustomFieldCohortCampaignAggRow[]>`
      with campaigns as (
        select
          coalesce(
            d.payload_json->>'campaignId',
            split_part(d.idempotency_key, ':', 2)
          ) as campaign_id,
          max(coalesce(d.payload_json->'email'->>'subject', d.payload_json->>'subject')) as subject,
          max(d.payload_json->>'audienceCaption') as audience_caption,
          max(coalesce(d.payload_json->>'source', d.template_key)) as source,
          max(d.payload_json->>'segmentId') as segment_id,
          max(d.payload_json->>'segmentName') as segment_name,
          coalesce(
            max(nullif(d.payload_json->>'recipientCount', '')::int),
            count(*)::int
          ) as recipient_count,
          count(*) filter (where d.status = 'SENT'::"DispatchStatus")::int as delivered_count,
          count(*) filter (where d.status = 'FAILED'::"DispatchStatus")::int as failed_count,
          greatest(
            coalesce(max(nullif(d.payload_json->>'skippedCount', '')::int), 0),
            0
          ) as skipped_count,
          max(coalesce(d.sent_at, d.created_at)) as sent_at,
          max(d.payload_json->>'sentByLabel') as sent_by_label
        from notification_dispatches d
        where d.tenant_id = current_setting('app.tenant_id', true)::uuid
          and d.template_key = ${CUSTOM_FIELD_MESSAGE_TEMPLATE_KEY}
        group by 1
      )
      select *
      from campaigns
      where campaign_id is not null
        and campaign_id <> ''
      order by sent_at desc
      limit ${args.limit}
      offset ${args.offset}
    `;
  },

  async findFailedMembershipIdsForCampaign(
    tx: TenantTx,
    campaignId: string,
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select d.membership_id::text as membership_id
      from notification_dispatches d
      where d.tenant_id = current_setting('app.tenant_id', true)::uuid
        and d.template_key = ${CUSTOM_FIELD_MESSAGE_TEMPLATE_KEY}
        and d.status = 'FAILED'::"DispatchStatus"
        and (
          d.payload_json->>'campaignId' = ${campaignId}
          or split_part(d.idempotency_key, ':', 2) = ${campaignId}
        )
    `;
    return rows.map((row) => row.membership_id);
  },

  async findCampaignMeta(
    tx: TenantTx,
    campaignId: string,
  ): Promise<{
    subject: string | null;
    message: string | null;
    source: string | null;
    audience_caption: string | null;
    segment_id: string | null;
    segment_name: string | null;
  } | null> {
    const rows = await tx.$queryRaw<
      Array<{
        subject: string | null;
        message: string | null;
        source: string | null;
        audience_caption: string | null;
        segment_id: string | null;
        segment_name: string | null;
      }>
    >`
      select
        coalesce(d.payload_json->'email'->>'subject', d.payload_json->>'subject') as subject,
        coalesce(d.payload_json->'email'->>'body', d.payload_json->>'message') as message,
        coalesce(d.payload_json->>'source', d.template_key) as source,
        d.payload_json->>'audienceCaption' as audience_caption,
        d.payload_json->>'segmentId' as segment_id,
        d.payload_json->>'segmentName' as segment_name
      from notification_dispatches d
      where d.tenant_id = current_setting('app.tenant_id', true)::uuid
        and d.template_key = ${CUSTOM_FIELD_MESSAGE_TEMPLATE_KEY}
        and (
          d.payload_json->>'campaignId' = ${campaignId}
          or split_part(d.idempotency_key, ':', 2) = ${campaignId}
        )
      order by d.created_at desc
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listRecentlyMessagedMembershipIds(
    tx: TenantTx,
    membershipIds: string[],
    withinDays: number,
  ): Promise<Set<string>> {
    if (membershipIds.length === 0 || withinDays <= 0) return new Set();
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select distinct d.membership_id::text as membership_id
      from notification_dispatches d
      where d.tenant_id = current_setting('app.tenant_id', true)::uuid
        and d.template_key = ${CUSTOM_FIELD_MESSAGE_TEMPLATE_KEY}
        and d.status = 'SENT'::"DispatchStatus"
        and d.membership_id = any(${membershipIds}::uuid[])
        and coalesce(d.sent_at, d.created_at) >= now() - (${withinDays}::int || ' days')::interval
    `;
    return new Set(rows.map((row) => row.membership_id));
  },

  async findActorDisplayName(tx: TenantTx, membershipId: string): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ display_name: string | null }>>`
      select coalesce(
        nullif(trim(mp.display_name), ''),
        nullif(trim(ap.email), '')
      ) as display_name
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id
        and mp.tenant_id = m.tenant_id
        and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.id = ${membershipId}::uuid
      limit 1
    `;
    return rows[0]?.display_name ?? null;
  },
};
