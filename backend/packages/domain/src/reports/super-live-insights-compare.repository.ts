import type { TenantTx } from "@atlas/db";
import type { SuperLiveInsightsCompareCandidatesQuery } from "./super-live-insights-compare.dto";

export type CompareSessionRow = {
  id: string;
  title: string;
  course_id: string | null;
  course_title: string | null;
  batch_id: string | null;
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
};

export type CompareSeriesRow = {
  id: string;
  title: string;
  session_count: number;
  attended_count: number;
  registered_count: number;
  absent_count: number;
  total_count: number;
  avg_rate: number | null;
  avg_duration_seconds: number | null;
  avg_session_duration_seconds: number | null;
  avg_coverage_pct: number | null;
  avg_start_delay_seconds: number | null;
};

export type CompareSeriesTrendPoint = {
  series_id: string;
  idx: number;
  attendance_rate: number | null;
};

export type CompareCandidateRow = {
  id: string;
  title: string;
  subtitle: string | null;
  group_label: string | null;
  scheduled_at: Date | null;
  attendance_rate: number | null;
  session_count: number | null;
};

function mapSessionRow(row: Record<string, unknown>): CompareSessionRow {
  return {
    id: String(row["id"]),
    title: String(row["title"]),
    course_id: typeof row["course_id"] === "string" ? row["course_id"] : null,
    course_title: typeof row["course_title"] === "string" ? row["course_title"] : null,
    batch_id: typeof row["batch_id"] === "string" ? row["batch_id"] : null,
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
  };
}

export const superLiveInsightsCompareRepository = {
  async listSessionsByIds(tx: TenantTx, ids: string[]): Promise<CompareSessionRow[]> {
    if (ids.length === 0) return [];
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as id,
        ls.title,
        ls.course_id::text as course_id,
        c.title as course_title,
        ls.batch_id::text as batch_id,
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
          when (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) = 0 then null
          else round(
            (
              (
                select count(*)::numeric from live_attendance la
                where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
              )
              / nullif(
                (
                  select count(*)::numeric from live_attendance la
                  where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
                ),
                0
              )
            ) * 100,
            1
          )::float8
        end as attendance_rate,
        case
          when ls.started_at is not null and ls.scheduled_at is not null
            then floor(extract(epoch from (ls.started_at - ls.scheduled_at)))::int
          else null
        end as start_delay_seconds
      from live_sessions ls
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.id = any(${ids}::uuid[])
    `;
    return rows.map(mapSessionRow);
  },

  async listSeriesByIds(
    tx: TenantTx,
    kind: "course" | "batch",
    ids: string[],
  ): Promise<CompareSeriesRow[]> {
    if (ids.length === 0) return [];
    const byCourse = kind === "course";
    const rows = await tx.$queryRaw<CompareSeriesRow[]>`
      with base as (
        select
          case
            when ${byCourse} then ls.course_id::text
            else ls.batch_id::text
          end as id,
          case
            when ${byCourse} then coalesce(c.title, 'No course')
            else coalesce(b.name, 'No batch')
          end as title,
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
            when ls.started_at is not null and ls.ended_at is not null
              then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int)
            else null
          end as session_duration_seconds,
          case
            when ls.started_at is not null and ls.scheduled_at is not null
              then floor(extract(epoch from (ls.started_at - ls.scheduled_at)))::int
            else null
          end as start_delay_seconds
        from live_sessions ls
        left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
        left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status <> 'cancelled'
          and (
            (${byCourse} and ls.course_id = any(${ids}::uuid[]))
            or (not ${byCourse} and ls.batch_id = any(${ids}::uuid[]))
          )
      )
      select
        id,
        max(title) as title,
        count(*)::int as session_count,
        coalesce(sum(attended_count), 0)::int as attended_count,
        coalesce(sum(registered_count), 0)::int as registered_count,
        coalesce(sum(absent_count), 0)::int as absent_count,
        coalesce(sum(total_count), 0)::int as total_count,
        case
          when coalesce(sum(total_count), 0) = 0 then null
          else round((sum(attended_count)::numeric / nullif(sum(total_count), 0)) * 100, 1)::float8
        end as avg_rate,
        case
          when count(*) filter (where avg_duration_seconds is not null) = 0 then null
          else round(avg(avg_duration_seconds) filter (where avg_duration_seconds is not null))::int
        end as avg_duration_seconds,
        case
          when count(*) filter (where session_duration_seconds is not null) = 0 then null
          else round(avg(session_duration_seconds) filter (where session_duration_seconds is not null))::int
        end as avg_session_duration_seconds,
        case
          when count(*) filter (
            where avg_duration_seconds is not null
              and session_duration_seconds is not null
              and session_duration_seconds > 0
          ) = 0 then null
          else round(
            avg(
              least(
                100,
                (avg_duration_seconds::numeric / nullif(session_duration_seconds, 0)) * 100
              )
            ) filter (
              where avg_duration_seconds is not null
                and session_duration_seconds is not null
                and session_duration_seconds > 0
            ),
            1
          )::float8
        end as avg_coverage_pct,
        case
          when count(*) filter (where start_delay_seconds is not null) = 0 then null
          else round(avg(start_delay_seconds) filter (where start_delay_seconds is not null))::int
        end as avg_start_delay_seconds
      from base
      where id is not null
      group by id
    `;
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      session_count: row.session_count,
      attended_count: row.attended_count,
      registered_count: row.registered_count,
      absent_count: row.absent_count,
      total_count: row.total_count,
      avg_rate: row.avg_rate == null ? null : row.avg_rate,
      avg_duration_seconds: row.avg_duration_seconds == null ? null : row.avg_duration_seconds,
      avg_session_duration_seconds:
        row.avg_session_duration_seconds == null ? null : row.avg_session_duration_seconds,
      avg_coverage_pct: row.avg_coverage_pct == null ? null : row.avg_coverage_pct,
      avg_start_delay_seconds:
        row.avg_start_delay_seconds == null ? null : row.avg_start_delay_seconds,
    }));
  },

  async listSeriesTrends(
    tx: TenantTx,
    kind: "course" | "batch",
    ids: string[],
  ): Promise<CompareSeriesTrendPoint[]> {
    if (ids.length === 0) return [];
    const byCourse = kind === "course";
    const rows = await tx.$queryRaw<
      Array<{ series_id: string; attendance_rate: number | null; ordered_at: Date | null }>
    >`
      select
        case
          when ${byCourse} then ls.course_id::text
          else ls.batch_id::text
        end as series_id,
        case
          when (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) = 0 then null
          else round(
            (
              (
                select count(*)::numeric from live_attendance la
                where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
              )
              / nullif(
                (
                  select count(*)::numeric from live_attendance la
                  where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
                ),
                0
              )
            ) * 100,
            1
          )::float8
        end as attendance_rate,
        coalesce(ls.scheduled_at, ls.started_at, ls.created_at) as ordered_at
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.status <> 'cancelled'
        and (
          (${byCourse} and ls.course_id = any(${ids}::uuid[]))
          or (not ${byCourse} and ls.batch_id = any(${ids}::uuid[]))
        )
      order by series_id, ordered_at asc nulls last
    `;

    const counters = new Map<string, number>();
    return rows.map((row) => {
      const seriesId = row.series_id;
      const next = (counters.get(seriesId) ?? 0) + 1;
      counters.set(seriesId, next);
      return {
        series_id: seriesId,
        idx: next,
        attendance_rate: row.attendance_rate == null ? null : row.attendance_rate,
      };
    });
  },

  async tenantAverages(tx: TenantTx): Promise<{
    attendanceRate: number | null;
    coveragePct: number | null;
    avgDurationSeconds: number | null;
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        avg_rate: number | null;
        avg_coverage: number | null;
        avg_duration: number | null;
      }>
    >`
      with m as (
        select
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
          ) as attended_count,
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
            when ls.started_at is not null and ls.ended_at is not null
              then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int)
            else null
          end as session_duration_seconds
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status <> 'cancelled'
          and coalesce(ls.started_at, ls.scheduled_at) >= (now() - interval '90 days')
      )
      select
        case
          when coalesce(sum(total_count), 0) = 0 then null
          else round((sum(attended_count)::numeric / nullif(sum(total_count), 0)) * 100, 1)::float8
        end as avg_rate,
        case
          when count(*) filter (
            where avg_duration_seconds is not null
              and session_duration_seconds is not null
              and session_duration_seconds > 0
          ) = 0 then null
          else round(
            avg(
              least(
                100,
                (avg_duration_seconds::numeric / nullif(session_duration_seconds, 0)) * 100
              )
            ) filter (
              where avg_duration_seconds is not null
                and session_duration_seconds is not null
                and session_duration_seconds > 0
            ),
            1
          )::float8
        end as avg_coverage,
        case
          when count(*) filter (where avg_duration_seconds is not null) = 0 then null
          else round(avg(avg_duration_seconds) filter (where avg_duration_seconds is not null))::int
        end as avg_duration
      from m
    `;
    const row = rows[0];
    return {
      attendanceRate: row?.avg_rate == null ? null : row.avg_rate,
      coveragePct: row?.avg_coverage == null ? null : row.avg_coverage,
      avgDurationSeconds: row?.avg_duration == null ? null : row.avg_duration,
    };
  },

  async listCandidates(
    tx: TenantTx,
    query: SuperLiveInsightsCompareCandidatesQuery,
  ): Promise<CompareCandidateRow[]> {
    const exclude = query.excludeIds;
    const q = query.q ?? null;
    const limit = query.limit;

    if (query.mode === "series") {
      const byCourse = (query.seriesKind ?? "course") === "course";
      const rows = await tx.$queryRaw<CompareCandidateRow[]>`
        select
          case
            when ${byCourse} then ls.course_id::text
            else ls.batch_id::text
          end as id,
          case
            when ${byCourse} then coalesce(c.title, 'No course')
            else coalesce(b.name, 'No batch')
          end as title,
          null::text as subtitle,
          null::text as group_label,
          max(coalesce(ls.scheduled_at, ls.started_at)) as scheduled_at,
          case
            when coalesce(sum(m.total_count), 0) = 0 then null
            else round((sum(m.attended_count)::numeric / nullif(sum(m.total_count), 0)) * 100, 1)::float8
          end as attendance_rate,
          count(*)::int as session_count
        from live_sessions ls
        left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
        left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
        cross join lateral (
          select
            (
              select count(*)::int from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
            ) as attended_count,
            (
              select count(*)::int from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
            ) as total_count
        ) m
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status <> 'cancelled'
          and (
            (${byCourse} and ls.course_id is not null)
            or (not ${byCourse} and ls.batch_id is not null)
          )
          and (
            ${q}::text is null
            or (
              ${byCourse} and lower(coalesce(c.title, '')) like '%' || lower(${q}) || '%'
            )
            or (
              not ${byCourse} and lower(coalesce(b.name, '')) like '%' || lower(${q}) || '%'
            )
          )
          and (
            cardinality(${exclude}::uuid[]) = 0
            or not (
              (${byCourse} and ls.course_id = any(${exclude}::uuid[]))
              or (not ${byCourse} and ls.batch_id = any(${exclude}::uuid[]))
            )
          )
        group by 1, 2
        order by session_count desc, title asc
        limit ${limit}
      `;
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: null,
        group_label: null,
        scheduled_at: row.scheduled_at instanceof Date ? row.scheduled_at : null,
        attendance_rate: row.attendance_rate == null ? null : row.attendance_rate,
        session_count: row.session_count == null ? null : row.session_count,
      }));
    }

    const rows = await tx.$queryRaw<CompareCandidateRow[]>`
      select
        ls.id::text as id,
        ls.title,
        coalesce(b.name, null) as subtitle,
        coalesce(c.title, 'No course') as group_label,
        ls.scheduled_at,
        case
          when (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) = 0 then null
          else round(
            (
              (
                select count(*)::numeric from live_attendance la
                where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
              )
              / nullif(
                (
                  select count(*)::numeric from live_attendance la
                  where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
                ),
                0
              )
            ) * 100,
            1
          )::float8
        end as attendance_rate,
        null::int as session_count
      from live_sessions ls
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.status <> 'cancelled'
        and (
          ${q}::text is null
          or lower(ls.title) like '%' || lower(${q}) || '%'
          or lower(coalesce(c.title, '')) like '%' || lower(${q}) || '%'
        )
        and (
          cardinality(${exclude}::uuid[]) = 0
          or not (ls.id = any(${exclude}::uuid[]))
        )
      order by coalesce(ls.scheduled_at, ls.started_at) desc nulls last
      limit ${limit}
    `;
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: typeof row.subtitle === "string" ? row.subtitle : null,
      group_label: typeof row.group_label === "string" ? row.group_label : null,
      scheduled_at: row.scheduled_at instanceof Date ? row.scheduled_at : null,
      attendance_rate: row.attendance_rate == null ? null : row.attendance_rate,
      session_count: null,
    }));
  },
};
