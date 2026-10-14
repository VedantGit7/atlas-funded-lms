import type { TenantTx } from "@atlas/db";
import { asUnknownString } from "./batches-roster.repository-helpers";

/**
 * A batch's messages: nudge settings, history and the audiences a message can target.
 * Part of batchesRosterRepository.
 */
export const batchesRosterMessagesRepository = {
  async updateBatchMetadata(tx: TenantTx, batchId: string, metadata: unknown): Promise<void> {
    await tx.$executeRaw`
      update batches
      set metadata_json = ${JSON.stringify(metadata ?? {})}::jsonb,
          updated_at = now()
      where id = ${batchId}::uuid
    `;
  },

  async listBatchMessageHistory(
    tx: TenantTx,
    batchId: string,
    query: { page: number; limit: number },
  ): Promise<{
    items: Array<{
      send_group_id: string;
      subject: string;
      audience_label: string;
      recipient_count: number;
      delivered_count: number;
      skipped_count: number;
      failed_count: number;
      channels: string[];
      status: "sent" | "partially_failed" | "scheduled" | "failed";
      sent_at: Date | null;
      scheduled_at: Date | null;
      sent_by_label: string | null;
      is_automated: boolean;
    }>;
    totalCount: number;
  }> {
    const offset = (query.page - 1) * query.limit;
    const countRows = await tx.$queryRaw<Array<{ count: number }>>`
      select count(*)::int as count
      from (
        select coalesce(
          nullif(nd.payload_json->>'sendGroupId', ''),
          nd.idempotency_key
        ) as send_group_id
        from notification_dispatches nd
        where nd.tenant_id = current_setting('app.tenant_id', true)::uuid
          and nd.template_key = 'reports.batches.message'
          and nd.payload_json->>'batchId' = ${batchId}
        group by 1
      ) groups
    `;
    const totalCount = countRows[0]?.count ?? 0;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with grouped as (
        select
          coalesce(
            nullif(nd.payload_json->>'sendGroupId', ''),
            nd.idempotency_key
          ) as send_group_id,
          max(coalesce(nd.payload_json->'email'->>'subject', nd.payload_json->>'subject', 'Message')) as subject,
          max(coalesce(nd.payload_json->>'audienceLabel', 'Learners')) as audience_label,
          count(*)::int as recipient_count,
          count(*) filter (where nd.status::text = 'SENT')::int as delivered_count,
          count(*) filter (
            where nd.status::text = 'QUEUED'
              or coalesce(nd.payload_json->>'skipped', 'false') = 'true'
          )::int as skipped_count,
          count(*) filter (where nd.status::text = 'FAILED')::int as failed_count,
          array_agg(distinct nd.channel) as channels,
          max(nd.sent_at) as sent_at,
          max(nullif(nd.payload_json->>'scheduleAt', '')::timestamptz) as scheduled_at,
          max(nd.payload_json->>'sentByLabel') as sent_by_label,
          bool_or(coalesce((nd.payload_json->>'isAutomated')::boolean, false)) as is_automated,
          max(nd.created_at) as created_at
        from notification_dispatches nd
        where nd.tenant_id = current_setting('app.tenant_id', true)::uuid
          and nd.template_key = 'reports.batches.message'
          and nd.payload_json->>'batchId' = ${batchId}
        group by 1
      )
      select *
      from grouped
      order by coalesce(sent_at, scheduled_at, created_at) desc nulls last
      limit ${query.limit} offset ${offset}
    `;

    return {
      totalCount,
      items: rows.map((row) => {
        const delivered = Number(row["delivered_count"] ?? 0);
        const failed = Number(row["failed_count"] ?? 0);
        const scheduledAt = row["scheduled_at"] == null ? null : (row["scheduled_at"] as Date);
        const sentAt = row["sent_at"] == null ? null : (row["sent_at"] as Date);
        let status: "sent" | "partially_failed" | "scheduled" | "failed" = "sent";
        if (scheduledAt && !sentAt && delivered === 0 && failed === 0) {
          status = "scheduled";
        } else if (failed > 0 && delivered > 0) {
          status = "partially_failed";
        } else if (failed > 0 && delivered === 0) {
          status = "failed";
        }
        const channelsRaw = row["channels"];
        const channels = Array.isArray(channelsRaw) ? channelsRaw.map((c) => String(c)) : ["email"];
        return {
          send_group_id: asUnknownString(row["send_group_id"]),
          subject: asUnknownString(row["subject"], "Message"),
          audience_label: asUnknownString(row["audience_label"], "Learners"),
          recipient_count: Number(row["recipient_count"] ?? 0),
          delivered_count: delivered,
          skipped_count: Number(row["skipped_count"] ?? 0),
          failed_count: failed,
          channels,
          status,
          sent_at: sentAt,
          scheduled_at: scheduledAt,
          sent_by_label:
            row["sent_by_label"] == null ? null : asUnknownString(row["sent_by_label"]),
          is_automated: Boolean(row["is_automated"]),
        };
      }),
    };
  },

  async listBatchAtRiskMembershipIds(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      with roster as (
        select
          bm.membership_id,
          (
            select max(coalesce(lp.completed_at, lp.updated_at, lp.last_seen_at, a.joined_at, a.left_at))
            from (
              select lp.completed_at, lp.updated_at, lp.last_seen_at, null::timestamptz as joined_at, null::timestamptz as left_at
              from lesson_progress lp
              where lp.membership_id = bm.membership_id
                and lp.tenant_id = bm.tenant_id
              union all
              select null, null, null, la.joined_at, la.left_at
              from live_attendance la
              where la.membership_id = bm.membership_id
                and la.tenant_id = bm.tenant_id
            ) a
          ) as activity_at,
          case when ${courseId ?? null}::uuid is null then 0
            else (
              select count(*)::int
              from lessons l
              join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
              where cm.course_id = ${courseId ?? null}::uuid
                and l.deleted_at is null and cm.deleted_at is null
            )
          end as total_lessons,
          case when ${courseId ?? null}::uuid is null then 0
            else (
              select count(*)::int
              from lesson_progress lp
              join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
              join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
              where lp.membership_id = bm.membership_id
                and lp.status = 'completed'
                and cm.course_id = ${courseId ?? null}::uuid
            )
          end as completed_lessons
        from batch_memberships bm
        where bm.batch_id = ${batchId}::uuid
      ),
      scored as (
        select
          membership_id,
          case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0
          end as content_completion_pct,
          activity_at
        from roster
      )
      select membership_id::text as membership_id
      from scored
      where content_completion_pct < 40
         or activity_at is null
         or activity_at < now() - interval '14 days'
      order by content_completion_pct asc
    `;
    return rows.map((row) => row.membership_id);
  },

  async listMissedLastSessionMembershipIds(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      with last_session as (
        select ls.id as live_session_id
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ls.batch_id = ${batchId}::uuid
            or (
              ${courseId ?? null}::uuid is not null
              and ls.course_id = ${courseId ?? null}::uuid
            )
          )
          and lower(ls.status) in ('ended', 'completed', 'live')
        order by coalesce(ls.ended_at, ls.started_at, ls.scheduled_at) desc nulls last
        limit 1
      ),
      roster as (
        select bm.membership_id
        from batch_memberships bm
        where bm.batch_id = ${batchId}::uuid
      )
      select r.membership_id::text as membership_id
      from roster r
      cross join last_session ls
      where not exists (
        select 1
        from live_attendance la
        where la.live_session_id = ls.live_session_id
          and la.membership_id = r.membership_id
          and la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            la.joined_at is not null
            or la.status in ('attended', 'present', 'joined')
          )
      )
      order by r.membership_id
    `;
    return rows.map((row) => row.membership_id);
  },

  async listRecentlyMessagedMembershipIds(
    tx: TenantTx,
    batchId: string,
    withinDays: number,
  ): Promise<string[]> {
    if (withinDays <= 0) return [];
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select distinct nd.membership_id::text as membership_id
      from notification_dispatches nd
      where nd.tenant_id = current_setting('app.tenant_id', true)::uuid
        and nd.template_key = 'reports.batches.message'
        and nd.payload_json->>'batchId' = ${batchId}
        and nd.membership_id is not null
        and nd.status::text = 'SENT'
        and nd.created_at >= now() - make_interval(days => ${withinDays})
    `;
    return rows.map((row) => row.membership_id);
  },

  async listFailedMembershipIdsForSendGroup(
    tx: TenantTx,
    batchId: string,
    sendGroupId: string,
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select distinct nd.membership_id::text as membership_id
      from notification_dispatches nd
      where nd.tenant_id = current_setting('app.tenant_id', true)::uuid
        and nd.template_key = 'reports.batches.message'
        and nd.payload_json->>'batchId' = ${batchId}
        and nd.payload_json->>'sendGroupId' = ${sendGroupId}
        and nd.status::text = 'FAILED'
        and nd.membership_id is not null
    `;
    return rows.map((row) => row.membership_id);
  },
};
