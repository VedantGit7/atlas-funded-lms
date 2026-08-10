import type { TenantTx } from "@atlas/db";

export type OutlierSessionRow = {
  id: string;
  title: string;
  course_id: string | null;
  course_title: string | null;
  batch_name: string | null;
  scheduled_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number | null;
  attended_count: number;
  registered_count: number;
  absent_count: number;
  total_count: number;
  avg_duration_seconds: number | null;
  attendance_rate: number | null;
  start_delay_seconds: number | null;
  course_avg_rate: number | null;
  expected_registrations: number;
};

export const superLiveInsightsOutliersRepository = {
  async listSessionsInRange(
    tx: TenantTx,
    startedFrom: string,
    startedTo: string,
  ): Promise<OutlierSessionRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with session_base as (
        select
          ls.id,
          ls.title,
          ls.course_id,
          c.title as course_title,
          b.name as batch_name,
          ls.scheduled_at,
          ls.started_at,
          ls.ended_at,
          case
            when ls.started_at is not null and ls.ended_at is not null
              then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int)
            else null
          end as duration_seconds,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
          ) as attended_count,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'registered'
          ) as registered_count,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'absent'
          ) as absent_count,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) as total_count,
          (
            select
              case
                when count(*) filter (where la.duration_seconds is not null and la.status = 'attended') = 0
                  then null
                else round(
                  avg(la.duration_seconds) filter (
                    where la.duration_seconds is not null and la.status = 'attended'
                  )
                )::int
              end
            from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) as avg_duration_seconds,
          case
            when ls.started_at is not null and ls.scheduled_at is not null
              then floor(extract(epoch from (ls.started_at - ls.scheduled_at)))::int
            else null
          end as start_delay_seconds,
          (
            select count(*)::int
            from enrollments e
            where e.tenant_id = ls.tenant_id
              and e.course_id = ls.course_id
              and e.status in ('active', 'completed')
          ) as expected_registrations
        from live_sessions ls
        left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
        left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status <> 'cancelled'
          and coalesce(ls.started_at, ls.scheduled_at) >= ${startedFrom}::timestamptz
          and coalesce(ls.started_at, ls.scheduled_at) <= ${startedTo}::timestamptz
      ),
      course_rates as (
        select
          course_id,
          case
            when coalesce(sum(total_count), 0) = 0 then null
            else round((sum(attended_count)::numeric / nullif(sum(total_count), 0)) * 100, 1)::float8
          end as course_avg_rate
        from session_base
        where course_id is not null
        group by course_id
      )
      select
        sb.id::text as id,
        sb.title,
        sb.course_id::text as course_id,
        sb.course_title,
        sb.batch_name,
        sb.scheduled_at,
        sb.started_at,
        sb.ended_at,
        sb.duration_seconds,
        sb.attended_count,
        sb.registered_count,
        sb.absent_count,
        sb.total_count,
        sb.avg_duration_seconds,
        case
          when sb.total_count = 0 then null
          else round((sb.attended_count::numeric / nullif(sb.total_count, 0)) * 100, 1)::float8
        end as attendance_rate,
        sb.start_delay_seconds,
        cr.course_avg_rate,
        coalesce(sb.expected_registrations, 0)::int as expected_registrations
      from session_base sb
      left join course_rates cr on cr.course_id = sb.course_id
      order by coalesce(sb.scheduled_at, sb.started_at) desc nulls last
    `;

    return rows.map((row) => ({
      id: String(row["id"]),
      title: String(row["title"]),
      course_id: typeof row["course_id"] === "string" ? row["course_id"] : null,
      course_title: typeof row["course_title"] === "string" ? row["course_title"] : null,
      batch_name: typeof row["batch_name"] === "string" ? row["batch_name"] : null,
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
      ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
      duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
      attended_count: Number(row["attended_count"] ?? 0),
      registered_count: Number(row["registered_count"] ?? 0),
      absent_count: Number(row["absent_count"] ?? 0),
      total_count: Number(row["total_count"] ?? 0),
      avg_duration_seconds:
        row["avg_duration_seconds"] == null ? null : Number(row["avg_duration_seconds"]),
      attendance_rate: row["attendance_rate"] == null ? null : Number(row["attendance_rate"]),
      start_delay_seconds:
        row["start_delay_seconds"] == null ? null : Number(row["start_delay_seconds"]),
      course_avg_rate: row["course_avg_rate"] == null ? null : Number(row["course_avg_rate"]),
      expected_registrations: Number(row["expected_registrations"] ?? 0),
    }));
  },
};
