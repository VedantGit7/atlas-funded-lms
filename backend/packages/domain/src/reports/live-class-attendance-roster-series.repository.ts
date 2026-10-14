import type { TenantTx } from "@atlas/db";

/**
 * Cohort attendance rates and series statistics.
 * Part of liveClassAttendanceRosterRepository.
 */
export const liveClassAttendanceRosterSeriesRepository = {
  async summarizeCohortAttendanceRate(
    tx: TenantTx,
    args: {
      batchId?: string | null;
      courseId?: string | null;
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
    },
  ): Promise<number | null> {
    const rows = await tx.$queryRaw<Array<{ avg_rate: number | null }>>`
      with scoped as (
        select ls.id, ls.batch_id, ls.course_id
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status in ('scheduled', 'live', 'ended', 'in_progress', 'completed')
          and (
            ${args.batchId ?? null}::uuid is null
            or ls.batch_id = ${args.batchId ?? null}::uuid
          )
          and (
            ${args.courseId ?? null}::uuid is null
            or ls.course_id = ${args.courseId ?? null}::uuid
          )
          and (
            ${args.scheduledFrom ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) >= ${args.scheduledFrom ?? null}::timestamptz
          )
          and (
            ${args.scheduledTo ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) <= ${args.scheduledTo ?? null}::timestamptz
          )
      ),
      per_learner as (
        select
          la.membership_id,
          count(*)::float as registered_count,
          count(*) filter (where la.status = 'attended' or la.joined_at is not null)::float
            as attended_count
        from live_attendance la
        join scoped ss on ss.id = la.live_session_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        group by la.membership_id
        having count(*) > 0
      )
      select
        case when count(*) = 0 then null
          else round(avg((attended_count / registered_count) * 100.0)::numeric, 1)::float
        end as avg_rate
      from per_learner
    `;
    const value = rows[0]?.avg_rate;
    return value == null ? null : value;
  },

  async listCohortMonthlyAttendanceRates(
    tx: TenantTx,
    args: {
      batchId?: string | null;
      courseId?: string | null;
      monthKeys: string[];
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
    },
  ): Promise<Array<{ month_key: string; avg_rate: number | null }>> {
    if (args.monthKeys.length === 0) return [];
    const rows = await tx.$queryRaw<Array<{ month_key: string; avg_rate: number | null }>>`
      with scoped as (
        select
          ls.id,
          to_char(date_trunc('month', coalesce(ls.scheduled_at, ls.started_at)), 'YYYY-MM')
            as month_key
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status in ('scheduled', 'live', 'ended', 'in_progress', 'completed')
          and coalesce(ls.scheduled_at, ls.started_at) is not null
          and (
            ${args.batchId ?? null}::uuid is null
            or ls.batch_id = ${args.batchId ?? null}::uuid
          )
          and (
            ${args.courseId ?? null}::uuid is null
            or ls.course_id = ${args.courseId ?? null}::uuid
          )
          and (
            ${args.scheduledFrom ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) >= ${args.scheduledFrom ?? null}::timestamptz
          )
          and (
            ${args.scheduledTo ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) <= ${args.scheduledTo ?? null}::timestamptz
          )
      ),
      per_learner_month as (
        select
          ss.month_key,
          la.membership_id,
          count(*)::float as registered_count,
          count(*) filter (where la.status = 'attended' or la.joined_at is not null)::float
            as attended_count
        from live_attendance la
        join scoped ss on ss.id = la.live_session_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ss.month_key = any(${args.monthKeys}::text[])
        group by ss.month_key, la.membership_id
        having count(*) > 0
      )
      select
        month_key,
        round(avg((attended_count / registered_count) * 100.0)::numeric, 1)::float as avg_rate
      from per_learner_month
      group by month_key
      order by month_key asc
    `;
    return rows.map((row) => ({
      month_key: row.month_key,
      avg_rate: row.avg_rate == null ? null : row.avg_rate,
    }));
  },

  async listSeriesSessionStats(
    tx: TenantTx,
    args: {
      groupBy: "course" | "batch";
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
    },
  ): Promise<
    Array<{
      series_id: string;
      series_title: string;
      secondary_id: string | null;
      secondary_title: string | null;
      session_id: string;
      session_title: string;
      status: string;
      scheduled_at: Date | null;
      registered_count: number;
      attended_count: number;
      avg_coverage_pct: number | null;
    }>
  > {
    const byCourse = args.groupBy === "course";
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with scoped as (
        select
          ls.id,
          ls.title,
          ls.status,
          ls.course_id,
          ls.batch_id,
          coalesce(ls.scheduled_at, ls.started_at) as scheduled_at,
          ls.started_at,
          ls.ended_at,
          case
            when ${byCourse} then ls.course_id
            else ls.batch_id
          end as series_id
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${args.scheduledFrom ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) >= ${args.scheduledFrom ?? null}::timestamptz
          )
          and (
            ${args.scheduledTo ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) <= ${args.scheduledTo ?? null}::timestamptz
          )
          and (
            (${byCourse} and ls.course_id is not null)
            or (not ${byCourse} and ls.batch_id is not null)
          )
      ),
      attendance_agg as (
        select
          la.live_session_id,
          count(*)::int as registered_count,
          count(*) filter (where la.status = 'attended' or la.joined_at is not null)::int
            as attended_count,
          avg(
            case
              when la.duration_seconds is null then null
              when ss.started_at is not null and ss.ended_at is not null
                and extract(epoch from (ss.ended_at - ss.started_at)) > 0
                then least(
                  100.0,
                  (la.duration_seconds::float / extract(epoch from (ss.ended_at - ss.started_at))) * 100.0
                )
              else null
            end
          ) as avg_coverage_pct
        from live_attendance la
        join scoped ss on ss.id = la.live_session_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        group by la.live_session_id
      )
      select
        ss.series_id::text as series_id,
        case
          when ${byCourse} then coalesce(c.title, 'Untitled course')
          else coalesce(b.name, 'Untitled batch')
        end as series_title,
        case
          when ${byCourse} then ss.batch_id::text
          else ss.course_id::text
        end as secondary_id,
        case
          when ${byCourse} then b.name
          else c.title
        end as secondary_title,
        ss.id::text as session_id,
        ss.title as session_title,
        ss.status,
        ss.scheduled_at,
        coalesce(aa.registered_count, 0)::int as registered_count,
        coalesce(aa.attended_count, 0)::int as attended_count,
        case when aa.avg_coverage_pct is null then null
          else round(aa.avg_coverage_pct::numeric, 1)::float end as avg_coverage_pct
      from scoped ss
      left join attendance_agg aa on aa.live_session_id = ss.id
      left join courses c on c.id = ss.course_id and c.tenant_id = current_setting('app.tenant_id', true)::uuid
      left join batches b on b.id = ss.batch_id and b.tenant_id = current_setting('app.tenant_id', true)::uuid
      where ss.series_id is not null
      order by ss.series_id, ss.scheduled_at asc nulls last, ss.id asc
    `;

    return rows.map((row) => ({
      series_id: String(row["series_id"]),
      series_title: typeof row["series_title"] === "string" ? row["series_title"] : "Untitled",
      secondary_id: typeof row["secondary_id"] === "string" ? row["secondary_id"] : null,
      secondary_title: typeof row["secondary_title"] === "string" ? row["secondary_title"] : null,
      session_id: String(row["session_id"]),
      session_title: String(row["session_title"]),
      status: String(row["status"]),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      registered_count: Number(row["registered_count"] ?? 0),
      attended_count: Number(row["attended_count"] ?? 0),
      avg_coverage_pct: row["avg_coverage_pct"] == null ? null : Number(row["avg_coverage_pct"]),
    }));
  },

  async listSeriesNeverAttendingCounts(
    tx: TenantTx,
    args: {
      groupBy: "course" | "batch";
      seriesIds: string[];
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
    },
  ): Promise<Array<{ series_id: string; never_count: number }>> {
    if (args.seriesIds.length === 0) return [];
    const byCourse = args.groupBy === "course";
    const rows = await tx.$queryRaw<Array<{ series_id: string; never_count: number }>>`
      with scoped as (
        select
          ls.id,
          case when ${byCourse} then ls.course_id else ls.batch_id end as series_id
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            (${byCourse} and ls.course_id = any(${args.seriesIds}::uuid[]))
            or (not ${byCourse} and ls.batch_id = any(${args.seriesIds}::uuid[]))
          )
          and (
            ${args.scheduledFrom ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) >= ${args.scheduledFrom ?? null}::timestamptz
          )
          and (
            ${args.scheduledTo ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) <= ${args.scheduledTo ?? null}::timestamptz
          )
      ),
      per_learner as (
        select
          ss.series_id,
          la.membership_id,
          bool_or(la.status = 'attended' or la.joined_at is not null) as ever_attended
        from live_attendance la
        join scoped ss on ss.id = la.live_session_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        group by ss.series_id, la.membership_id
      )
      select
        series_id::text as series_id,
        count(*) filter (where not ever_attended)::int as never_count
      from per_learner
      group by series_id
    `;
    return rows.map((row) => ({
      series_id: row.series_id,
      never_count: row.never_count,
    }));
  },

  async listSeriesDropOffMembershipAttendance(
    tx: TenantTx,
    args: {
      groupBy: "course" | "batch";
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
      maxOrdinal?: number;
    },
  ): Promise<
    Array<{
      series_id: string;
      session_id: string;
      scheduled_at: Date | null;
      membership_id: string;
      attended: boolean;
    }>
  > {
    const byCourse = args.groupBy === "course";
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with scoped as (
        select
          ls.id,
          coalesce(ls.scheduled_at, ls.started_at) as scheduled_at,
          case when ${byCourse} then ls.course_id else ls.batch_id end as series_id
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status not in ('cancelled', 'canceled')
          and (
            (${byCourse} and ls.course_id is not null)
            or (not ${byCourse} and ls.batch_id is not null)
          )
          and (
            ${args.scheduledFrom ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) >= ${args.scheduledFrom ?? null}::timestamptz
          )
          and (
            ${args.scheduledTo ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) <= ${args.scheduledTo ?? null}::timestamptz
          )
      )
      select
        ss.series_id::text as series_id,
        ss.id::text as session_id,
        ss.scheduled_at,
        la.membership_id::text as membership_id,
        (la.status = 'attended' or la.joined_at is not null) as attended
      from live_attendance la
      join scoped ss on ss.id = la.live_session_id
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
      order by ss.series_id, ss.scheduled_at asc nulls last, ss.id asc
    `;
    return rows.map((row) => ({
      series_id: String(row["series_id"]),
      session_id: String(row["session_id"]),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      membership_id: String(row["membership_id"]),
      attended: Boolean(row["attended"]),
    }));
  },
};
