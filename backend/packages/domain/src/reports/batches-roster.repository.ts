import type { TenantTx } from "@atlas/db";
import type { BatchesListQuery, BatchLearnersQuery } from "./batches-roster.dto";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function asUnknownString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return fallback;
  return fallback;
}

export type BatchListRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  course_id: string | null;
  course_title: string | null;
  status: string;
  starts_at: Date | null;
  ends_at: Date | null;
  member_count: number;
  avg_content_completion_pct: number | null;
  avg_live_attendance_pct: number | null;
  avg_test_score_pct: number | null;
  last_activity_at: Date | null;
  health: "on_track" | "at_risk" | "critical";
  created_at: Date;
};

export type BatchesListSummaryRow = {
  active_batch_count: number;
  total_learners: number;
  avg_content_completion_pct: number | null;
  avg_live_attendance_pct: number | null;
  at_risk_count: number;
  ending_soon_count: number;
};

export type BatchLearnerRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  activity_at: Date | null;
  live_attendance_pct: number | null;
  live_attended_count: number;
  live_session_count: number;
  test_score_pct: number | null;
  test_attempt_count: number;
  content_completion_pct: number;
  completed_lessons: number;
  total_lessons: number;
  joined_at: Date;
  health: "on_track" | "at_risk" | "critical";
};

export type UpcomingSessionRow = {
  live_session_id: string;
  title: string;
  scheduled_at: Date | null;
  status: string;
  duration_minutes: number | null;
};

export type CohortTrendRow = {
  week_start: Date;
  week_label: string;
  content_completion_pct: number | null;
  live_attendance_pct: number | null;
  test_score_pct: number | null;
};

export type LiveSessionCounts = {
  total_count: number;
  held_count: number;
};

export type BatchLiveSessionRow = {
  id: string;
  title: string;
  kind: string | null;
  status: string;
  host_label: string | null;
  scheduled_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  planned_duration_minutes: number | null;
  actual_duration_minutes: number | null;
  roster_count: number;
  attended_count: number;
  attendance_rate_pct: number | null;
  avg_watch_minutes: number | null;
  late_count: number;
  recording_url: string | null;
  has_recording: boolean;
};

export type BatchLiveSessionsSummaryRow = {
  avg_attendance_pct: number | null;
  sessions_held_count: number;
  sessions_total_count: number;
  perfect_attendance_count: number;
  missed_three_or_more_count: number;
  avg_watch_minutes: number | null;
  planned_watch_minutes: number | null;
  roster_count: number;
};

export type BatchLiveSessionDetailRow = {
  id: string;
  title: string;
  kind: string | null;
  status: string;
  host_label: string | null;
  scheduled_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  planned_duration_minutes: number | null;
  actual_duration_minutes: number | null;
  recording_url: string | null;
  timezone_label: string | null;
  batch_id: string | null;
  course_id: string | null;
};

export type BatchLiveSessionAttendeeRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  raw_status: string | null;
  joined_at: Date | null;
  left_at: Date | null;
  duration_seconds: number | null;
  rejoins: number | null;
  device_label: string | null;
};

export type BatchLiveSessionIntervalRow = {
  membership_id: string;
  joined_at: Date;
  left_at: Date | null;
  duration_seconds: number | null;
};

export type BatchExamAssessmentRow = {
  assessment_id: string;
  title: string;
  assessment_type: string;
  released_at: Date | null;
  pass_mark_pct: number;
  roster_count: number;
  attempted_count: number;
  attempted_pct: number | null;
  avg_score_pct: number | null;
  pass_rate_pct: number | null;
  high_score_pct: number | null;
  low_score_pct: number | null;
  awaiting_grading_count: number;
  health_rail: "none" | "success" | "warning" | "danger";
  dist_min: number | null;
  dist_q1: number | null;
  dist_median: number | null;
  dist_q3: number | null;
  dist_max: number | null;
};

export type BatchExamsSummaryRow = {
  avg_score_pct: number | null;
  pass_mark_pct: number;
  pass_rate_pct: number | null;
  passed_learner_count: number;
  roster_count: number;
  attempt_count: number;
  attempts_per_learner: number | null;
  awaiting_grading_count: number;
  not_attempted_count: number;
  assessment_count: number;
};

export type BatchLearnersFilter = {
  batchId: string;
  learnerName?: string;
  joinedFrom?: string;
  joinedTo?: string;
  minCompletion?: number;
  maxCompletion?: number;
};

export type LiveAttendanceDetailRow = {
  live_session_id: string;
  title: string;
  scheduled_at: Date | null;
  status: string;
  session_status: string;
  session_kind: string | null;
  joined_at: Date | null;
  left_at: Date | null;
  duration_seconds: number | null;
  planned_duration_minutes: number | null;
};

export type ExamDetailRow = {
  assessment_id: string;
  assessment_title: string;
  attempt_id: string;
  attempt_status: string;
  score_pct: number | null;
  submitted_at: Date | null;
  started_at: Date;
  duration_seconds: number | null;
};

export type CourseProgressDetailRow = {
  course_id: string;
  course_title: string;
  completed_lessons: number;
  total_lessons: number;
  completion_pct: number;
  last_lesson_title: string | null;
};

export type LessonStripRow = {
  lesson_id: string;
  title: string;
  sort_order: number;
  completed: boolean;
};

export type ActivityDayRow = {
  activity_date: Date;
  event_count: number;
};

export const batchesRosterRepository = {
  async findBatchMeta(
    tx: TenantTx,
    batchId: string,
  ): Promise<{
    id: string;
    key: string;
    name: string;
    description: string | null;
    course_id: string | null;
    course_title: string | null;
    status: string;
    starts_at: Date | null;
    ends_at: Date | null;
    created_at: Date;
    metadata_json: unknown;
  } | null> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        key: string;
        name: string;
        description: string | null;
        course_id: string | null;
        course_title: string | null;
        status: string;
        starts_at: Date | null;
        ends_at: Date | null;
        created_at: Date;
        metadata_json: unknown;
      }>
    >`
      select
        b.id::text as id,
        b.key,
        b.name,
        b.description,
        b.course_id::text as course_id,
        c.title as course_title,
        b.status::text as status,
        b.starts_at,
        b.ends_at,
        b.created_at,
        b.metadata_json
      from batches b
      left join courses c on c.id = b.course_id and c.tenant_id = b.tenant_id and c.deleted_at is null
      where b.id = ${batchId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async countBatches(tx: TenantTx, query: BatchesListQuery): Promise<number> {
    const window = query.window;
    const health = query.health;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with batch_base as (
        select
          b.id,
          b.course_id,
          b.status,
          b.starts_at,
          b.ends_at,
          (
            select count(*)::int
            from batch_memberships bm
            where bm.batch_id = b.id and bm.tenant_id = b.tenant_id
          ) as member_count
        from batches b
        where b.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${query.status ?? null}::text is null or b.status::text = ${query.status ?? null})
          and (
            ${query.q ?? null}::text is null
            or lower(b.name) like '%' || lower(${query.q ?? null}) || '%'
            or lower(b.key) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${window}::text = 'any'
            or (
              ${window}::text = 'running'
              and (b.starts_at is null or b.starts_at <= now())
              and (b.ends_at is null or b.ends_at >= now())
            )
            or (
              ${window}::text = 'starting_soon'
              and b.starts_at is not null
              and b.starts_at > now()
              and b.starts_at <= now() + interval '30 days'
            )
            or (
              ${window}::text = 'ending_soon'
              and b.ends_at is not null
              and b.ends_at >= now()
              and b.ends_at <= now() + interval '30 days'
            )
            or (
              ${window}::text = 'ended'
              and b.ends_at is not null
              and b.ends_at < now()
            )
          )
      ),
      batch_metrics as (
        select
          bb.id,
          bb.status,
          bb.ends_at,
          (
            select max(m.last_active_at)
            from batch_memberships bm
            join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
            where bm.batch_id = bb.id and bm.tenant_id = current_setting('app.tenant_id', true)::uuid
          ) as last_activity_at,
          (
            select round(avg(learner.completion_pct))::float
            from (
              select
                case when totals.total_lessons > 0
                  then round((completed.completed_lessons::numeric / totals.total_lessons::numeric) * 100)
                  else 0
                end as completion_pct
              from batch_memberships bm
              left join lateral (
                select count(*)::int as total_lessons
                from lessons l
                join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                where cm.course_id = bb.course_id
                  and l.deleted_at is null
                  and cm.deleted_at is null
              ) totals on true
              left join lateral (
                select count(*)::int as completed_lessons
                from lesson_progress lp
                join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
                join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
                where lp.membership_id = bm.membership_id
                  and lp.tenant_id = bm.tenant_id
                  and lp.status = 'completed'
                  and cm.course_id = bb.course_id
              ) completed on true
              where bm.batch_id = bb.id
                and bb.course_id is not null
            ) learner
          ) as avg_content_completion_pct,
          (
            select round(avg(
              case when sess.session_count > 0
                then (att.attended_count::numeric / sess.session_count::numeric) * 100
                else null
              end
            ))::float
            from batch_memberships bm
            left join lateral (
              select count(*)::int as session_count
              from live_sessions ls
              where ls.tenant_id = bm.tenant_id
                and (
                  ls.batch_id = bb.id
                  or (bb.course_id is not null and ls.course_id = bb.course_id)
                )
            ) sess on true
            left join lateral (
              select count(*)::int as attended_count
              from live_attendance la
              join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
              where la.membership_id = bm.membership_id
                and la.tenant_id = bm.tenant_id
                and (
                  ls.batch_id = bb.id
                  or (bb.course_id is not null and ls.course_id = bb.course_id)
                )
                and (
                  la.status in ('attended', 'present', 'joined')
                  or la.joined_at is not null
                )
            ) att on true
            where bm.batch_id = bb.id
          ) as avg_live_attendance_pct,
          (
            select round(avg(latest.score_pct)::numeric, 1)::float
            from batch_memberships bm
            join lateral (
              select at.score_pct
              from attempts at
              where at.membership_id = bm.membership_id
                and at.tenant_id = bm.tenant_id
                and at.score_pct is not null
                and (
                  bb.course_id is null
                  or exists (
                    select 1
                    from lessons l
                    join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                    where cm.course_id = bb.course_id
                      and l.deleted_at is null
                      and coalesce(
                        l.content_json->'content'->>'assessmentId',
                        l.content_json->>'assessmentId'
                      ) = at.assessment_id::text
                  )
                )
              order by coalesce(at.submitted_at, at.started_at) desc
              limit 1
            ) latest on true
            where bm.batch_id = bb.id
          ) as avg_test_score_pct
        from batch_base bb
      ),
      batch_scored as (
        select
          bm.*,
          case
            when (
              (case when bm.avg_content_completion_pct is not null and bm.avg_content_completion_pct < 40 then 1 else 0 end)
              + (case when bm.avg_live_attendance_pct is not null and bm.avg_live_attendance_pct < 40 then 1 else 0 end)
              + (case when bm.avg_test_score_pct is not null and bm.avg_test_score_pct < 40 then 1 else 0 end)
            ) >= 2 then 'critical'
            when (
              (case when bm.avg_content_completion_pct is not null and bm.avg_content_completion_pct < 40 then 1 else 0 end)
              + (case when bm.avg_live_attendance_pct is not null and bm.avg_live_attendance_pct < 40 then 1 else 0 end)
              + (case when bm.avg_test_score_pct is not null and bm.avg_test_score_pct < 40 then 1 else 0 end)
            ) >= 1 then 'at_risk'
            when bm.last_activity_at is null or bm.last_activity_at < now() - interval '14 days' then 'at_risk'
            else 'on_track'
          end as health
        from batch_metrics bm
      )
      select count(*)::bigint as count
      from batch_scored bs
      where (
        ${health}::text = 'any'
        or bs.health = ${health}
        or (${health}::text = 'needs_attention' and bs.health in ('at_risk', 'critical'))
      )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async summarizeBatches(tx: TenantTx, query: BatchesListQuery): Promise<BatchesListSummaryRow> {
    const window = query.window;
    const health = query.health;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with batch_base as (
        select
          b.id,
          b.course_id,
          b.status,
          b.starts_at,
          b.ends_at,
          (
            select count(*)::int
            from batch_memberships bm
            where bm.batch_id = b.id and bm.tenant_id = b.tenant_id
          ) as member_count
        from batches b
        where b.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${query.status ?? null}::text is null or b.status::text = ${query.status ?? null})
          and (
            ${query.q ?? null}::text is null
            or lower(b.name) like '%' || lower(${query.q ?? null}) || '%'
            or lower(b.key) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${window}::text = 'any'
            or (
              ${window}::text = 'running'
              and (b.starts_at is null or b.starts_at <= now())
              and (b.ends_at is null or b.ends_at >= now())
            )
            or (
              ${window}::text = 'starting_soon'
              and b.starts_at is not null
              and b.starts_at > now()
              and b.starts_at <= now() + interval '30 days'
            )
            or (
              ${window}::text = 'ending_soon'
              and b.ends_at is not null
              and b.ends_at >= now()
              and b.ends_at <= now() + interval '30 days'
            )
            or (
              ${window}::text = 'ended'
              and b.ends_at is not null
              and b.ends_at < now()
            )
          )
      ),
      batch_metrics as (
        select
          bb.id,
          bb.status,
          bb.ends_at,
          bb.member_count,
          (
            select max(m.last_active_at)
            from batch_memberships bm
            join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
            where bm.batch_id = bb.id and bm.tenant_id = current_setting('app.tenant_id', true)::uuid
          ) as last_activity_at,
          (
            select round(avg(learner.completion_pct))::float
            from (
              select
                case when totals.total_lessons > 0
                  then round((completed.completed_lessons::numeric / totals.total_lessons::numeric) * 100)
                  else 0
                end as completion_pct
              from batch_memberships bm
              left join lateral (
                select count(*)::int as total_lessons
                from lessons l
                join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                where cm.course_id = bb.course_id
                  and l.deleted_at is null
                  and cm.deleted_at is null
              ) totals on true
              left join lateral (
                select count(*)::int as completed_lessons
                from lesson_progress lp
                join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
                join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
                where lp.membership_id = bm.membership_id
                  and lp.tenant_id = bm.tenant_id
                  and lp.status = 'completed'
                  and cm.course_id = bb.course_id
              ) completed on true
              where bm.batch_id = bb.id
                and bb.course_id is not null
            ) learner
          ) as avg_content_completion_pct,
          (
            select round(avg(
              case when sess.session_count > 0
                then (att.attended_count::numeric / sess.session_count::numeric) * 100
                else null
              end
            ))::float
            from batch_memberships bm
            left join lateral (
              select count(*)::int as session_count
              from live_sessions ls
              where ls.tenant_id = bm.tenant_id
                and (
                  ls.batch_id = bb.id
                  or (bb.course_id is not null and ls.course_id = bb.course_id)
                )
            ) sess on true
            left join lateral (
              select count(*)::int as attended_count
              from live_attendance la
              join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
              where la.membership_id = bm.membership_id
                and la.tenant_id = bm.tenant_id
                and (
                  ls.batch_id = bb.id
                  or (bb.course_id is not null and ls.course_id = bb.course_id)
                )
                and (
                  la.status in ('attended', 'present', 'joined')
                  or la.joined_at is not null
                )
            ) att on true
            where bm.batch_id = bb.id
          ) as avg_live_attendance_pct,
          (
            select round(avg(latest.score_pct)::numeric, 1)::float
            from batch_memberships bm
            join lateral (
              select at.score_pct
              from attempts at
              where at.membership_id = bm.membership_id
                and at.tenant_id = bm.tenant_id
                and at.score_pct is not null
                and (
                  bb.course_id is null
                  or exists (
                    select 1
                    from lessons l
                    join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                    where cm.course_id = bb.course_id
                      and l.deleted_at is null
                      and coalesce(
                        l.content_json->'content'->>'assessmentId',
                        l.content_json->>'assessmentId'
                      ) = at.assessment_id::text
                  )
                )
              order by coalesce(at.submitted_at, at.started_at) desc
              limit 1
            ) latest on true
            where bm.batch_id = bb.id
          ) as avg_test_score_pct
        from batch_base bb
      ),
      batch_scored as (
        select
          bm.*,
          case
            when (
              (case when bm.avg_content_completion_pct is not null and bm.avg_content_completion_pct < 40 then 1 else 0 end)
              + (case when bm.avg_live_attendance_pct is not null and bm.avg_live_attendance_pct < 40 then 1 else 0 end)
              + (case when bm.avg_test_score_pct is not null and bm.avg_test_score_pct < 40 then 1 else 0 end)
            ) >= 2 then 'critical'
            when (
              (case when bm.avg_content_completion_pct is not null and bm.avg_content_completion_pct < 40 then 1 else 0 end)
              + (case when bm.avg_live_attendance_pct is not null and bm.avg_live_attendance_pct < 40 then 1 else 0 end)
              + (case when bm.avg_test_score_pct is not null and bm.avg_test_score_pct < 40 then 1 else 0 end)
            ) >= 1 then 'at_risk'
            when bm.last_activity_at is null or bm.last_activity_at < now() - interval '14 days' then 'at_risk'
            else 'on_track'
          end as health
        from batch_metrics bm
      )
      select
        coalesce(count(*) filter (where bs.status = 'ACTIVE'), 0)::int as active_batch_count,
        coalesce(sum(bs.member_count), 0)::int as total_learners,
        round(avg(bs.avg_content_completion_pct)::numeric, 1)::float as avg_content_completion_pct,
        round(avg(bs.avg_live_attendance_pct)::numeric, 1)::float as avg_live_attendance_pct,
        coalesce(count(*) filter (where bs.health in ('at_risk', 'critical')), 0)::int as at_risk_count,
        coalesce(
          count(*) filter (
            where bs.ends_at is not null
              and bs.ends_at >= now()
              and bs.ends_at <= now() + interval '30 days'
          ),
          0
        )::int as ending_soon_count
      from batch_scored bs
      where (
        ${health}::text = 'any'
        or bs.health = ${health}
        or (${health}::text = 'needs_attention' and bs.health in ('at_risk', 'critical'))
      )
    `;

    const row = rows[0] ?? {};
    return {
      active_batch_count: Number(row["active_batch_count"] ?? 0),
      total_learners: Number(row["total_learners"] ?? 0),
      avg_content_completion_pct:
        row["avg_content_completion_pct"] == null
          ? null
          : Number(row["avg_content_completion_pct"]),
      avg_live_attendance_pct:
        row["avg_live_attendance_pct"] == null ? null : Number(row["avg_live_attendance_pct"]),
      at_risk_count: Number(row["at_risk_count"] ?? 0),
      ending_soon_count: Number(row["ending_soon_count"] ?? 0),
    };
  },

  async listBatches(tx: TenantTx, query: BatchesListQuery): Promise<BatchListRow[]> {
    const skip = (query.page - 1) * query.limit;
    const window = query.window;
    const health = query.health;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with batch_base as (
        select
          b.id,
          b.key,
          b.name,
          b.description,
          b.course_id,
          b.status,
          b.starts_at,
          b.ends_at,
          b.created_at,
          c.title as course_title,
          (
            select count(*)::int
            from batch_memberships bm
            where bm.batch_id = b.id and bm.tenant_id = b.tenant_id
          ) as member_count
        from batches b
        left join courses c on c.id = b.course_id and c.tenant_id = b.tenant_id and c.deleted_at is null
        where b.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${query.status ?? null}::text is null or b.status::text = ${query.status ?? null})
          and (
            ${query.q ?? null}::text is null
            or lower(b.name) like '%' || lower(${query.q ?? null}) || '%'
            or lower(b.key) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${window}::text = 'any'
            or (
              ${window}::text = 'running'
              and (b.starts_at is null or b.starts_at <= now())
              and (b.ends_at is null or b.ends_at >= now())
            )
            or (
              ${window}::text = 'starting_soon'
              and b.starts_at is not null
              and b.starts_at > now()
              and b.starts_at <= now() + interval '30 days'
            )
            or (
              ${window}::text = 'ending_soon'
              and b.ends_at is not null
              and b.ends_at >= now()
              and b.ends_at <= now() + interval '30 days'
            )
            or (
              ${window}::text = 'ended'
              and b.ends_at is not null
              and b.ends_at < now()
            )
          )
      ),
      batch_metrics as (
        select
          bb.id,
          bb.key,
          bb.name,
          bb.description,
          bb.course_id,
          bb.course_title,
          bb.status,
          bb.starts_at,
          bb.ends_at,
          bb.member_count,
          bb.created_at,
          (
            select max(m.last_active_at)
            from batch_memberships bm
            join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
            where bm.batch_id = bb.id and bm.tenant_id = current_setting('app.tenant_id', true)::uuid
          ) as last_activity_at,
          (
            select round(avg(learner.completion_pct))::float
            from (
              select
                case when totals.total_lessons > 0
                  then round((completed.completed_lessons::numeric / totals.total_lessons::numeric) * 100)
                  else 0
                end as completion_pct
              from batch_memberships bm
              left join lateral (
                select count(*)::int as total_lessons
                from lessons l
                join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                where cm.course_id = bb.course_id
                  and l.deleted_at is null
                  and cm.deleted_at is null
              ) totals on true
              left join lateral (
                select count(*)::int as completed_lessons
                from lesson_progress lp
                join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
                join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
                where lp.membership_id = bm.membership_id
                  and lp.tenant_id = bm.tenant_id
                  and lp.status = 'completed'
                  and cm.course_id = bb.course_id
              ) completed on true
              where bm.batch_id = bb.id
                and bb.course_id is not null
            ) learner
          ) as avg_content_completion_pct,
          (
            select round(avg(
              case when sess.session_count > 0
                then (att.attended_count::numeric / sess.session_count::numeric) * 100
                else null
              end
            ))::float
            from batch_memberships bm
            left join lateral (
              select count(*)::int as session_count
              from live_sessions ls
              where ls.tenant_id = bm.tenant_id
                and (
                  ls.batch_id = bb.id
                  or (bb.course_id is not null and ls.course_id = bb.course_id)
                )
            ) sess on true
            left join lateral (
              select count(*)::int as attended_count
              from live_attendance la
              join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
              where la.membership_id = bm.membership_id
                and la.tenant_id = bm.tenant_id
                and (
                  ls.batch_id = bb.id
                  or (bb.course_id is not null and ls.course_id = bb.course_id)
                )
                and (
                  la.status in ('attended', 'present', 'joined')
                  or la.joined_at is not null
                )
            ) att on true
            where bm.batch_id = bb.id
          ) as avg_live_attendance_pct,
          (
            select round(avg(latest.score_pct)::numeric, 1)::float
            from batch_memberships bm
            join lateral (
              select at.score_pct
              from attempts at
              where at.membership_id = bm.membership_id
                and at.tenant_id = bm.tenant_id
                and at.score_pct is not null
                and (
                  bb.course_id is null
                  or exists (
                    select 1
                    from lessons l
                    join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                    where cm.course_id = bb.course_id
                      and l.deleted_at is null
                      and coalesce(
                        l.content_json->'content'->>'assessmentId',
                        l.content_json->>'assessmentId'
                      ) = at.assessment_id::text
                  )
                )
              order by coalesce(at.submitted_at, at.started_at) desc
              limit 1
            ) latest on true
            where bm.batch_id = bb.id
          ) as avg_test_score_pct
        from batch_base bb
      ),
      batch_scored as (
        select
          bm.*,
          case
            when (
              (case when bm.avg_content_completion_pct is not null and bm.avg_content_completion_pct < 40 then 1 else 0 end)
              + (case when bm.avg_live_attendance_pct is not null and bm.avg_live_attendance_pct < 40 then 1 else 0 end)
              + (case when bm.avg_test_score_pct is not null and bm.avg_test_score_pct < 40 then 1 else 0 end)
            ) >= 2 then 'critical'
            when (
              (case when bm.avg_content_completion_pct is not null and bm.avg_content_completion_pct < 40 then 1 else 0 end)
              + (case when bm.avg_live_attendance_pct is not null and bm.avg_live_attendance_pct < 40 then 1 else 0 end)
              + (case when bm.avg_test_score_pct is not null and bm.avg_test_score_pct < 40 then 1 else 0 end)
            ) >= 1 then 'at_risk'
            when bm.last_activity_at is null or bm.last_activity_at < now() - interval '14 days' then 'at_risk'
            else 'on_track'
          end as health
        from batch_metrics bm
      )
      select
        bs.id::text as id,
        bs.key,
        bs.name,
        bs.description,
        bs.course_id::text as course_id,
        bs.course_title,
        bs.status::text as status,
        bs.starts_at,
        bs.ends_at,
        bs.member_count,
        bs.created_at,
        bs.last_activity_at,
        bs.avg_content_completion_pct,
        bs.avg_live_attendance_pct,
        bs.avg_test_score_pct,
        bs.health
      from batch_scored bs
      where (
        ${health}::text = 'any'
        or bs.health = ${health}
        or (${health}::text = 'needs_attention' and bs.health in ('at_risk', 'critical'))
      )
      order by
        case when ${sortBy} = 'member_count' and ${sortDir} = 'asc' then bs.member_count end asc nulls last,
        case when ${sortBy} = 'member_count' and ${sortDir} = 'desc' then bs.member_count end desc nulls last,
        case when ${sortBy} = 'avg_content_completion_pct' and ${sortDir} = 'asc' then bs.avg_content_completion_pct end asc nulls last,
        case when ${sortBy} = 'avg_content_completion_pct' and ${sortDir} = 'desc' then bs.avg_content_completion_pct end desc nulls last,
        case when ${sortBy} = 'avg_live_attendance_pct' and ${sortDir} = 'asc' then bs.avg_live_attendance_pct end asc nulls last,
        case when ${sortBy} = 'avg_live_attendance_pct' and ${sortDir} = 'desc' then bs.avg_live_attendance_pct end desc nulls last,
        case when ${sortBy} = 'avg_test_score_pct' and ${sortDir} = 'asc' then bs.avg_test_score_pct end asc nulls last,
        case when ${sortBy} = 'avg_test_score_pct' and ${sortDir} = 'desc' then bs.avg_test_score_pct end desc nulls last,
        case when ${sortBy} = 'starts_at' and ${sortDir} = 'asc' then bs.starts_at end asc nulls last,
        case when ${sortBy} = 'starts_at' and ${sortDir} = 'desc' then bs.starts_at end desc nulls last,
        case when ${sortBy} = 'name' and ${sortDir} = 'asc' then lower(bs.name) end asc,
        case when ${sortBy} = 'name' and ${sortDir} = 'desc' then lower(bs.name) end desc,
        case when ${sortBy} = 'created_at' and ${sortDir} = 'asc' then bs.created_at end asc,
        case when ${sortBy} = 'created_at' and ${sortDir} = 'desc' then bs.created_at end desc,
        bs.created_at desc
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map((row) => {
      const healthValue = asUnknownString(row["health"], "on_track");
      const healthNormalized =
        healthValue === "critical" || healthValue === "at_risk" || healthValue === "on_track"
          ? healthValue
          : "on_track";
      return {
        id: asUnknownString(row["id"]),
        key: asUnknownString(row["key"]),
        name: asUnknownString(row["name"]),
        description: typeof row["description"] === "string" ? row["description"] : null,
        course_id: typeof row["course_id"] === "string" ? row["course_id"] : null,
        course_title: typeof row["course_title"] === "string" ? row["course_title"] : null,
        status: asUnknownString(row["status"]),
        starts_at: row["starts_at"] instanceof Date ? row["starts_at"] : null,
        ends_at: row["ends_at"] instanceof Date ? row["ends_at"] : null,
        member_count: Number(row["member_count"] ?? 0),
        avg_content_completion_pct:
          row["avg_content_completion_pct"] == null
            ? null
            : Number(row["avg_content_completion_pct"]),
        avg_live_attendance_pct:
          row["avg_live_attendance_pct"] == null ? null : Number(row["avg_live_attendance_pct"]),
        avg_test_score_pct:
          row["avg_test_score_pct"] == null ? null : Number(row["avg_test_score_pct"]),
        last_activity_at: row["last_activity_at"] instanceof Date ? row["last_activity_at"] : null,
        health: healthNormalized,
        created_at: row["created_at"] as Date,
      };
    });
  },

  async countActiveLearners(tx: TenantTx, batchId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from batch_memberships bm
      join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
      where bm.batch_id = ${batchId}::uuid
        and m.last_active_at is not null
        and m.last_active_at >= now() - interval '14 days'
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countLiveSessions(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
  ): Promise<LiveSessionCounts> {
    const rows = await tx.$queryRaw<Array<{ total_count: number; held_count: number }>>`
      select
        count(*)::int as total_count,
        count(*) filter (
          where ls.status in ('ended', 'completed', 'live', 'in_progress')
            or ls.ended_at is not null
            or ls.started_at is not null
            or (ls.scheduled_at is not null and ls.scheduled_at < now())
        )::int as held_count
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ls.batch_id = ${batchId}::uuid
          or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
        )
    `;
    return {
      total_count: rows[0]?.total_count ?? 0,
      held_count: rows[0]?.held_count ?? 0,
    };
  },

  async listUpcomingSessions(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    limit = 5,
  ): Promise<UpcomingSessionRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as live_session_id,
        ls.title,
        ls.scheduled_at,
        ls.status,
        case
          when ls.started_at is not null and ls.ended_at is not null
            then greatest(1, round(extract(epoch from (ls.ended_at - ls.started_at)) / 60.0)::int)
          else null
        end as duration_minutes
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ls.batch_id = ${batchId}::uuid
          or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
        )
        and (
          ls.status in ('scheduled', 'upcoming')
          or (ls.scheduled_at is not null and ls.scheduled_at >= now() and ls.ended_at is null)
        )
      order by coalesce(ls.scheduled_at, ls.created_at) asc
      limit ${limit}
    `;
    return rows.map((row) => ({
      live_session_id: asUnknownString(row["live_session_id"]),
      title: asUnknownString(row["title"], "Live session"),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      status: asUnknownString(row["status"], "scheduled"),
      duration_minutes: row["duration_minutes"] == null ? null : Number(row["duration_minutes"]),
    }));
  },

  async listCohortTrend(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
  ): Promise<CohortTrendRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with week_spine as (
        select generate_series(
          date_trunc('week', now() - interval '11 weeks'),
          date_trunc('week', now()),
          interval '1 week'
        ) as week_start
      ),
      session_weeks as (
        select
          date_trunc('week', coalesce(ls.scheduled_at, ls.started_at, ls.created_at)) as week_start,
          ls.id as live_session_id,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and (
                la.status in ('attended', 'present', 'joined')
                or la.joined_at is not null
              )
          ) as attended_count,
          (
            select count(*)::int
            from batch_memberships bm
            where bm.batch_id = ${batchId}::uuid
              and bm.tenant_id = ls.tenant_id
          ) as member_count
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ls.batch_id = ${batchId}::uuid
            or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
          )
          and coalesce(ls.scheduled_at, ls.started_at, ls.created_at) >= now() - interval '12 weeks'
      ),
      attendance_by_week as (
        select
          week_start,
          case
            when sum(member_count) > 0
              then round((sum(attended_count)::numeric / nullif(sum(member_count), 0)::numeric) * 100)::int
            else null
          end as live_attendance_pct
        from session_weeks
        group by week_start
      ),
      completion_by_week as (
        select
          date_trunc('week', lp.completed_at) as week_start,
          count(*)::int as completions
        from lesson_progress lp
        join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        join batch_memberships bm
          on bm.membership_id = lp.membership_id and bm.tenant_id = lp.tenant_id
        where lp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and bm.batch_id = ${batchId}::uuid
          and lp.status = 'completed'
          and lp.completed_at is not null
          and lp.completed_at >= now() - interval '12 weeks'
          and (${courseId ?? null}::uuid is null or cm.course_id = ${courseId ?? null}::uuid)
        group by date_trunc('week', lp.completed_at)
      ),
      max_completions as (
        select greatest(1, coalesce(max(completions), 1))::numeric as peak
        from completion_by_week
      )
      select
        ws.week_start,
        to_char(ws.week_start, '"W"IW') as week_label,
        case
          when cbw.completions is null then null
          else round((cbw.completions::numeric / mc.peak) * 100)::int
        end as content_completion_pct,
        abw.live_attendance_pct,
        null::float as test_score_pct
      from week_spine ws
      cross join max_completions mc
      left join attendance_by_week abw on abw.week_start = ws.week_start
      left join completion_by_week cbw on cbw.week_start = ws.week_start
      order by ws.week_start asc
    `;

    return rows.map((row, index) => ({
      week_start: row["week_start"] as Date,
      week_label:
        typeof row["week_label"] === "string" ? row["week_label"] : `W${String(index + 1)}`,
      content_completion_pct:
        row["content_completion_pct"] == null ? null : Number(row["content_completion_pct"]),
      live_attendance_pct:
        row["live_attendance_pct"] == null ? null : Number(row["live_attendance_pct"]),
      test_score_pct: row["test_score_pct"] == null ? null : Number(row["test_score_pct"]),
    }));
  },

  async countLearners(tx: TenantTx, filter: BatchLearnersFilter): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from batch_memberships bm
      join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where bm.tenant_id = current_setting('app.tenant_id', true)::uuid
        and bm.batch_id = ${filter.batchId}::uuid
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.joinedFrom ?? null}::timestamptz is null
          or bm.joined_at >= ${filter.joinedFrom ?? null}::timestamptz
        )
        and (
          ${filter.joinedTo ?? null}::timestamptz is null
          or bm.joined_at <= ${filter.joinedTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listLearners(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    query: BatchLearnersQuery,
  ): Promise<BatchLearnerRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with roster as (
        select
          bm.membership_id,
          bm.joined_at,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          m.last_active_at as activity_at,
          (
            select count(*)::int
            from live_sessions ls
            where ls.tenant_id = bm.tenant_id
              and (
                ls.batch_id = ${batchId}::uuid
                or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
              )
          ) as live_session_count,
          (
            select count(*)::int
            from live_attendance la
            join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
            where la.membership_id = bm.membership_id
              and la.tenant_id = bm.tenant_id
              and (
                ls.batch_id = ${batchId}::uuid
                or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
              )
              and (
                la.status in ('attended', 'present', 'joined')
                or la.joined_at is not null
              )
          ) as live_attended_count,
          (
            select count(*)::int
            from attempts at
            where at.membership_id = bm.membership_id
              and at.tenant_id = bm.tenant_id
              and (
                ${courseId ?? null}::uuid is null
                or exists (
                  select 1
                  from lessons l
                  join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                  where cm.course_id = ${courseId ?? null}::uuid
                    and l.deleted_at is null
                    and coalesce(
                      l.content_json->'content'->>'assessmentId',
                      l.content_json->>'assessmentId'
                    ) = at.assessment_id::text
                )
              )
          ) as test_attempt_count,
          (
            select at.score_pct
            from attempts at
            where at.membership_id = bm.membership_id
              and at.tenant_id = bm.tenant_id
              and at.score_pct is not null
              and (
                ${courseId ?? null}::uuid is null
                or exists (
                  select 1
                  from lessons l
                  join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                  where cm.course_id = ${courseId ?? null}::uuid
                    and l.deleted_at is null
                    and coalesce(
                      l.content_json->'content'->>'assessmentId',
                      l.content_json->>'assessmentId'
                    ) = at.assessment_id::text
                )
              )
            order by coalesce(at.submitted_at, at.started_at) desc
            limit 1
          ) as test_score_pct,
          (
            select count(*)::int
            from lessons l
            join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
            where ${courseId ?? null}::uuid is not null
              and cm.course_id = ${courseId ?? null}::uuid
              and l.deleted_at is null
              and cm.deleted_at is null
          ) as total_lessons,
          (
            select count(*)::int
            from lesson_progress lp
            join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
            join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
            where lp.membership_id = bm.membership_id
              and lp.tenant_id = bm.tenant_id
              and lp.status = 'completed'
              and ${courseId ?? null}::uuid is not null
              and cm.course_id = ${courseId ?? null}::uuid
          ) as completed_lessons
        from batch_memberships bm
        join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where bm.tenant_id = current_setting('app.tenant_id', true)::uuid
          and bm.batch_id = ${batchId}::uuid
          and (
            ${query.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.learnerName ?? null}) || '%'
          )
          and (
            ${query.joinedFrom ?? null}::timestamptz is null
            or bm.joined_at >= ${query.joinedFrom ?? null}::timestamptz
          )
          and (
            ${query.joinedTo ?? null}::timestamptz is null
            or bm.joined_at <= ${query.joinedTo ?? null}::timestamptz
          )
      ),
      scored as (
        select
          *,
          case when live_session_count > 0
            then round((live_attended_count::numeric / live_session_count::numeric) * 100)::int
            else null
          end as live_attendance_pct,
          case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0
          end as content_completion_pct
        from roster
      ),
      health_scored as (
        select
          *,
          case
            when (
              (case when content_completion_pct < 40 then 1 else 0 end)
              + (case when live_attendance_pct is not null and live_attendance_pct < 40 then 1 else 0 end)
              + (case when test_score_pct is not null and test_score_pct < 40 then 1 else 0 end)
            ) >= 2 then 'critical'
            when (
              (case when content_completion_pct < 40 then 1 else 0 end)
              + (case when live_attendance_pct is not null and live_attendance_pct < 40 then 1 else 0 end)
              + (case when test_score_pct is not null and test_score_pct < 40 then 1 else 0 end)
            ) >= 1 then 'at_risk'
            when activity_at is null or activity_at < now() - interval '14 days' then 'at_risk'
            else 'on_track'
          end as health
        from scored
      )
      select
        membership_id::text,
        learner_name,
        email,
        activity_at,
        live_attendance_pct,
        live_attended_count,
        live_session_count,
        test_score_pct,
        test_attempt_count,
        content_completion_pct,
        completed_lessons,
        total_lessons,
        joined_at,
        health
      from health_scored
      where (
          ${query.minCompletion ?? null}::float is null
          or content_completion_pct >= ${query.minCompletion ?? null}::float
        )
        and (
          ${query.maxCompletion ?? null}::float is null
          or content_completion_pct <= ${query.maxCompletion ?? null}::float
        )
        and (
          ${query.health}::text = 'any'
          or health = ${query.health}
          or (
            ${query.health}::text = 'needs_attention'
            and health in ('at_risk', 'critical')
          )
        )
      order by
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then learner_name end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then learner_name end desc nulls last,
        case when ${query.sortBy} = 'activity_at' and ${query.sortDir} = 'asc' then activity_at end asc nulls last,
        case when ${query.sortBy} = 'activity_at' and ${query.sortDir} = 'desc' then activity_at end desc nulls last,
        case when ${query.sortBy} = 'live_attendance_pct' and ${query.sortDir} = 'asc' then live_attendance_pct end asc nulls last,
        case when ${query.sortBy} = 'live_attendance_pct' and ${query.sortDir} = 'desc' then live_attendance_pct end desc nulls last,
        case when ${query.sortBy} = 'test_score_pct' and ${query.sortDir} = 'asc' then test_score_pct end asc nulls last,
        case when ${query.sortBy} = 'test_score_pct' and ${query.sortDir} = 'desc' then test_score_pct end desc nulls last,
        case when ${query.sortBy} = 'content_completion_pct' and ${query.sortDir} = 'asc' then content_completion_pct end asc,
        case when ${query.sortBy} = 'content_completion_pct' and ${query.sortDir} = 'desc' then content_completion_pct end desc,
        case when ${query.sortBy} = 'joined_at' and ${query.sortDir} = 'asc' then joined_at end asc,
        case when ${query.sortBy} = 'joined_at' and ${query.sortDir} = 'desc' then joined_at end desc,
        membership_id desc
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map((row) => {
      const healthValue = asUnknownString(row["health"], "on_track");
      const healthNormalized =
        healthValue === "critical" || healthValue === "at_risk" || healthValue === "on_track"
          ? healthValue
          : "on_track";
      return {
        membership_id: asUnknownString(row["membership_id"]),
        learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
        email: typeof row["email"] === "string" ? row["email"] : null,
        activity_at: row["activity_at"] instanceof Date ? row["activity_at"] : null,
        live_attendance_pct:
          row["live_attendance_pct"] == null ? null : Number(row["live_attendance_pct"]),
        live_attended_count: Number(row["live_attended_count"] ?? 0),
        live_session_count: Number(row["live_session_count"] ?? 0),
        test_score_pct: row["test_score_pct"] == null ? null : Number(row["test_score_pct"]),
        test_attempt_count: Number(row["test_attempt_count"] ?? 0),
        content_completion_pct: Number(row["content_completion_pct"] ?? 0),
        completed_lessons: Number(row["completed_lessons"] ?? 0),
        total_lessons: Number(row["total_lessons"] ?? 0),
        joined_at: row["joined_at"] as Date,
        health: healthNormalized,
      };
    });
  },

  async listLearnerMembershipIds(tx: TenantTx, filter: BatchLearnersFilter): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select bm.membership_id::text as membership_id
      from batch_memberships bm
      join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where bm.tenant_id = current_setting('app.tenant_id', true)::uuid
        and bm.batch_id = ${filter.batchId}::uuid
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.joinedFrom ?? null}::timestamptz is null
          or bm.joined_at >= ${filter.joinedFrom ?? null}::timestamptz
        )
        and (
          ${filter.joinedTo ?? null}::timestamptz is null
          or bm.joined_at <= ${filter.joinedTo ?? null}::timestamptz
        )
      order by membership_id
      limit 2000
    `;
    return rows.map((row) => row.membership_id);
  },

  async findBatchMember(
    tx: TenantTx,
    batchId: string,
    membershipId: string,
  ): Promise<{
    membership_id: string;
    learner_name: string | null;
    email: string | null;
    joined_at: Date;
    activity_at: Date | null;
  } | null> {
    const rows = await tx.$queryRaw<
      Array<{
        membership_id: string;
        learner_name: string | null;
        email: string | null;
        joined_at: Date;
        activity_at: Date | null;
      }>
    >`
      select
        bm.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        bm.joined_at,
        m.last_active_at as activity_at
      from batch_memberships bm
      join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where bm.batch_id = ${batchId}::uuid
        and bm.membership_id = ${membershipId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listLiveAttendanceForMember(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    membershipId: string,
  ): Promise<LiveAttendanceDetailRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as live_session_id,
        ls.title,
        ls.scheduled_at,
        coalesce(la.status, case
          when ls.status in ('scheduled', 'upcoming')
            or (ls.scheduled_at is not null and ls.scheduled_at > now() and ls.ended_at is null)
          then 'upcoming'
          else 'absent'
        end) as status,
        ls.status as session_status,
        coalesce(ls.metadata_json->>'kind', ls.metadata_json->>'type', null) as session_kind,
        la.joined_at,
        la.left_at,
        la.duration_seconds,
        case
          when ls.started_at is not null and ls.ended_at is not null
            then greatest(1, round(extract(epoch from (ls.ended_at - ls.started_at)) / 60.0)::int)
          when (ls.metadata_json->>'durationMinutes') ~ '^[0-9]+$'
            then (ls.metadata_json->>'durationMinutes')::int
          when (ls.metadata_json->>'duration_minutes') ~ '^[0-9]+$'
            then (ls.metadata_json->>'duration_minutes')::int
          else null
        end as planned_duration_minutes
      from live_sessions ls
      left join live_attendance la
        on la.live_session_id = ls.id
        and la.tenant_id = ls.tenant_id
        and la.membership_id = ${membershipId}::uuid
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ls.batch_id = ${batchId}::uuid
          or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
        )
      order by coalesce(ls.scheduled_at, ls.created_at) desc
      limit 200
    `;
    return rows.map((row) => ({
      live_session_id: asUnknownString(row["live_session_id"]),
      title: asUnknownString(row["title"], "Live session"),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      status: asUnknownString(row["status"], "absent"),
      session_status: asUnknownString(row["session_status"], "scheduled"),
      session_kind: typeof row["session_kind"] === "string" ? row["session_kind"] : null,
      joined_at: row["joined_at"] instanceof Date ? row["joined_at"] : null,
      left_at: row["left_at"] instanceof Date ? row["left_at"] : null,
      duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
      planned_duration_minutes:
        row["planned_duration_minutes"] == null ? null : Number(row["planned_duration_minutes"]),
    }));
  },

  async listExamsForMember(
    tx: TenantTx,
    courseId: string | null,
    membershipId: string,
  ): Promise<ExamDetailRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        a.id::text as assessment_id,
        a.title as assessment_title,
        at.id::text as attempt_id,
        at.status::text as attempt_status,
        at.score_pct,
        at.submitted_at,
        at.started_at,
        case
          when at.submitted_at is not null
            then greatest(0, round(extract(epoch from (at.submitted_at - at.started_at)))::int)
          else greatest(0, round(extract(epoch from (now() - at.started_at)))::int)
        end as duration_seconds
      from attempts at
      join assessments a on a.id = at.assessment_id and a.tenant_id = at.tenant_id
      where at.tenant_id = current_setting('app.tenant_id', true)::uuid
        and at.membership_id = ${membershipId}::uuid
        and (
          ${courseId ?? null}::uuid is null
          or exists (
            select 1
            from lessons l
            join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
            where cm.course_id = ${courseId ?? null}::uuid
              and l.deleted_at is null
              and coalesce(
                l.content_json->'content'->>'assessmentId',
                l.content_json->>'assessmentId'
              ) = a.id::text
          )
        )
      order by coalesce(at.submitted_at, at.started_at) desc
      limit 200
    `;
    return rows.map((row) => ({
      assessment_id: asUnknownString(row["assessment_id"]),
      assessment_title: asUnknownString(row["assessment_title"], "Assessment"),
      attempt_id: asUnknownString(row["attempt_id"]),
      attempt_status: asUnknownString(row["attempt_status"], "STARTED"),
      score_pct: row["score_pct"] == null ? null : Number(row["score_pct"]),
      submitted_at: row["submitted_at"] instanceof Date ? row["submitted_at"] : null,
      started_at: row["started_at"] as Date,
      duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
    }));
  },

  async listCourseProgressForMember(
    tx: TenantTx,
    courseId: string | null,
    membershipId: string,
  ): Promise<CourseProgressDetailRow[]> {
    return tx.$queryRaw<CourseProgressDetailRow[]>`
      with target_courses as (
        select c.id, c.title
        from courses c
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
          and (
            (${courseId ?? null}::uuid is not null and c.id = ${courseId ?? null}::uuid)
            or (
              ${courseId ?? null}::uuid is null
              and exists (
                select 1 from enrollments e
                where e.course_id = c.id
                  and e.membership_id = ${membershipId}::uuid
                  and e.tenant_id = c.tenant_id
              )
            )
          )
      )
      select
        tc.id::text as course_id,
        tc.title as course_title,
        (
          select count(*)::int
          from lesson_progress lp
          join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
          join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
          where lp.membership_id = ${membershipId}::uuid
            and lp.status = 'completed'
            and cm.course_id = tc.id
        ) as completed_lessons,
        (
          select count(*)::int
          from lessons l
          join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
          where cm.course_id = tc.id
            and l.deleted_at is null
            and cm.deleted_at is null
        ) as total_lessons,
        case when (
          select count(*)::int
          from lessons l
          join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
          where cm.course_id = tc.id
            and l.deleted_at is null
            and cm.deleted_at is null
        ) > 0
          then round((
            (
              select count(*)::int
              from lesson_progress lp
              join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
              join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
              where lp.membership_id = ${membershipId}::uuid
                and lp.status = 'completed'
                and cm.course_id = tc.id
            )::numeric / (
              select count(*)::int
              from lessons l
              join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
              where cm.course_id = tc.id
                and l.deleted_at is null
                and cm.deleted_at is null
            )::numeric
          ) * 100)::int
          else 0
        end as completion_pct,
        (
          select l.title
          from lesson_progress lp
          join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
          join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
          where lp.membership_id = ${membershipId}::uuid
            and cm.course_id = tc.id
          order by coalesce(lp.completed_at, lp.updated_at, lp.last_seen_at) desc
          limit 1
        ) as last_lesson_title
      from target_courses tc
      order by tc.title
    `;
  },

  async listLessonStripForCourse(
    tx: TenantTx,
    courseId: string,
    membershipId: string,
  ): Promise<LessonStripRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        l.id::text as lesson_id,
        l.title,
        row_number() over (
          order by cm.position nulls last, l.position nulls last, l.created_at
        )::int as sort_order,
        exists (
          select 1
          from lesson_progress lp
          where lp.lesson_id = l.id
            and lp.membership_id = ${membershipId}::uuid
            and lp.tenant_id = l.tenant_id
            and lp.status = 'completed'
        ) as completed
      from lessons l
      join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
      where l.tenant_id = current_setting('app.tenant_id', true)::uuid
        and cm.course_id = ${courseId}::uuid
        and l.deleted_at is null
      order by cm.position nulls last, l.position nulls last, l.created_at
      limit 80
    `;
    return rows.map((row) => ({
      lesson_id: asUnknownString(row["lesson_id"]),
      title: asUnknownString(row["title"], "Lesson"),
      sort_order: Number(row["sort_order"] ?? 0),
      completed: Boolean(row["completed"]),
    }));
  },

  async listActivityDaysForMember(
    tx: TenantTx,
    membershipId: string,
    courseId: string | null,
    batchId: string,
  ): Promise<ActivityDayRow[]> {
    return tx.$queryRaw<ActivityDayRow[]>`
      with events as (
        select date_trunc('day', lp.completed_at)::date as activity_date
        from lesson_progress lp
        join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where lp.membership_id = ${membershipId}::uuid
          and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and lp.status = 'completed'
          and lp.completed_at is not null
          and lp.completed_at >= now() - interval '84 days'
          and (${courseId ?? null}::uuid is null or cm.course_id = ${courseId ?? null}::uuid)
        union all
        select date_trunc('day', coalesce(la.joined_at, la.created_at))::date as activity_date
        from live_attendance la
        join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
        where la.membership_id = ${membershipId}::uuid
          and la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and coalesce(la.joined_at, la.created_at) >= now() - interval '84 days'
          and (
            ls.batch_id = ${batchId}::uuid
            or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
          )
        union all
        select date_trunc('day', coalesce(at.submitted_at, at.started_at))::date as activity_date
        from attempts at
        where at.membership_id = ${membershipId}::uuid
          and at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and coalesce(at.submitted_at, at.started_at) >= now() - interval '84 days'
      )
      select activity_date, count(*)::int as event_count
      from events
      where activity_date is not null
      group by activity_date
      order by activity_date asc
    `;
  },

  async removeBatchMember(tx: TenantTx, batchId: string, membershipId: string): Promise<boolean> {
    const count = await tx.$executeRaw`
      delete from batch_memberships
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and batch_id = ${batchId}::uuid
        and membership_id = ${membershipId}::uuid
    `;
    return count > 0;
  },

  async countBatchLiveSessions(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    query: {
      q?: string;
      status: "any" | "upcoming" | "completed" | "cancelled" | "live";
    },
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ls.batch_id = ${batchId}::uuid
          or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
        )
        and (
          ${query.q ?? null}::text is null
          or lower(ls.title) like '%' || lower(${query.q ?? null}) || '%'
        )
        and (
          ${query.status} = 'any'
          or (
            ${query.status} = 'upcoming'
            and (
              lower(ls.status) in ('scheduled', 'upcoming')
              or (
                ls.scheduled_at is not null
                and ls.scheduled_at >= now()
                and ls.ended_at is null
                and lower(ls.status) not in ('cancelled', 'canceled', 'ended', 'completed')
              )
            )
          )
          or (
            ${query.status} = 'completed'
            and (
              lower(ls.status) in ('ended', 'completed')
              or ls.ended_at is not null
              or (
                ls.scheduled_at is not null
                and ls.scheduled_at < now()
                and lower(ls.status) not in ('cancelled', 'canceled', 'scheduled', 'upcoming', 'live', 'in_progress')
              )
            )
          )
          or (
            ${query.status} = 'cancelled'
            and lower(ls.status) in ('cancelled', 'canceled')
          )
          or (
            ${query.status} = 'live'
            and lower(ls.status) in ('live', 'in_progress')
          )
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listBatchLiveSessions(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    query: {
      q?: string;
      status: "any" | "upcoming" | "completed" | "cancelled" | "live";
      sortBy: "scheduled_at" | "title" | "attendance_rate";
      sortDir: "asc" | "desc";
      page: number;
      limit: number;
      rosterCount: number;
    },
  ): Promise<BatchLiveSessionRow[]> {
    const skip = (query.page - 1) * query.limit;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;
    const rosterCount = query.rosterCount;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with scoped as (
        select
          ls.id,
          ls.title,
          ls.status,
          ls.scheduled_at,
          ls.started_at,
          ls.ended_at,
          ls.created_at,
          ls.metadata_json,
          coalesce(ls.metadata_json->>'kind', ls.metadata_json->>'type', null) as session_kind,
          coalesce(
            nullif(ls.metadata_json->>'host', ''),
            nullif(ls.metadata_json->>'hostName', ''),
            nullif(ls.metadata_json->>'host_label', ''),
            nullif(ls.metadata_json->>'instructor', ''),
            null
          ) as host_label,
          coalesce(
            nullif(ls.metadata_json->>'recordingUrl', ''),
            nullif(ls.metadata_json->>'recording_url', ''),
            nullif(ls.metadata_json->>'recording', ''),
            null
          ) as recording_url,
          case
            when (ls.metadata_json->>'durationMinutes') ~ '^[0-9]+$'
              then (ls.metadata_json->>'durationMinutes')::int
            when (ls.metadata_json->>'duration_minutes') ~ '^[0-9]+$'
              then (ls.metadata_json->>'duration_minutes')::int
            else null
          end as planned_duration_minutes,
          case
            when ls.started_at is not null and ls.ended_at is not null
              then greatest(1, round(extract(epoch from (ls.ended_at - ls.started_at)) / 60.0)::int)
            else null
          end as actual_duration_minutes,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and lower(la.status) in ('attended', 'present', 'joined', 'partial')
          ) as attended_count,
          (
            select coalesce(avg(la.duration_seconds), 0)::float
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and lower(la.status) in ('attended', 'present', 'joined', 'partial')
              and la.duration_seconds is not null
          ) as avg_duration_seconds,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and la.joined_at is not null
              and ls.scheduled_at is not null
              and la.joined_at > ls.scheduled_at + interval '5 minutes'
          ) as late_count
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ls.batch_id = ${batchId}::uuid
            or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
          )
          and (
            ${query.q ?? null}::text is null
            or lower(ls.title) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${query.status} = 'any'
            or (
              ${query.status} = 'upcoming'
              and (
                lower(ls.status) in ('scheduled', 'upcoming')
                or (
                  ls.scheduled_at is not null
                  and ls.scheduled_at >= now()
                  and ls.ended_at is null
                  and lower(ls.status) not in ('cancelled', 'canceled', 'ended', 'completed')
                )
              )
            )
            or (
              ${query.status} = 'completed'
              and (
                lower(ls.status) in ('ended', 'completed')
                or ls.ended_at is not null
                or (
                  ls.scheduled_at is not null
                  and ls.scheduled_at < now()
                  and lower(ls.status) not in ('cancelled', 'canceled', 'scheduled', 'upcoming', 'live', 'in_progress')
                )
              )
            )
            or (
              ${query.status} = 'cancelled'
              and lower(ls.status) in ('cancelled', 'canceled')
            )
            or (
              ${query.status} = 'live'
              and lower(ls.status) in ('live', 'in_progress')
            )
          )
      )
      select
        id::text as id,
        title,
        status,
        session_kind,
        host_label,
        scheduled_at,
        started_at,
        ended_at,
        planned_duration_minutes,
        actual_duration_minutes,
        ${rosterCount}::int as roster_count,
        attended_count,
        case
          when ${rosterCount}::int > 0
            and (
              lower(status) in ('ended', 'completed', 'live', 'in_progress')
              or ended_at is not null
              or (scheduled_at is not null and scheduled_at < now())
            )
            and lower(status) not in ('cancelled', 'canceled')
          then round((attended_count::numeric / ${rosterCount}::numeric) * 100, 1)::float
          else null
        end as attendance_rate_pct,
        case
          when avg_duration_seconds > 0
          then round((avg_duration_seconds / 60.0)::numeric, 1)::float
          else null
        end as avg_watch_minutes,
        late_count,
        recording_url
      from scoped
      order by
        case when ${sortBy} = 'title' and ${sortDir} = 'asc' then title end asc nulls last,
        case when ${sortBy} = 'title' and ${sortDir} = 'desc' then title end desc nulls last,
        case
          when ${sortBy} = 'attendance_rate' and ${sortDir} = 'asc'
          then case
            when ${rosterCount}::int > 0 then (attended_count::numeric / ${rosterCount}::numeric)
            else null
          end
        end asc nulls last,
        case
          when ${sortBy} = 'attendance_rate' and ${sortDir} = 'desc'
          then case
            when ${rosterCount}::int > 0 then (attended_count::numeric / ${rosterCount}::numeric)
            else null
          end
        end desc nulls last,
        case when ${sortBy} = 'scheduled_at' and ${sortDir} = 'asc' then coalesce(scheduled_at, created_at) end asc nulls last,
        case when ${sortBy} = 'scheduled_at' and ${sortDir} = 'desc' then coalesce(scheduled_at, created_at) end desc nulls last,
        coalesce(scheduled_at, created_at) desc
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map((row) => {
      const recordingUrl =
        typeof row["recording_url"] === "string" && row["recording_url"].length > 0
          ? row["recording_url"]
          : null;
      return {
        id: asUnknownString(row["id"]),
        title: asUnknownString(row["title"], "Live session"),
        kind: typeof row["session_kind"] === "string" ? row["session_kind"] : null,
        status: asUnknownString(row["status"], "scheduled"),
        host_label: typeof row["host_label"] === "string" ? row["host_label"] : null,
        scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
        started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
        ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
        planned_duration_minutes:
          row["planned_duration_minutes"] == null ? null : Number(row["planned_duration_minutes"]),
        actual_duration_minutes:
          row["actual_duration_minutes"] == null ? null : Number(row["actual_duration_minutes"]),
        roster_count: Number(row["roster_count"] ?? rosterCount),
        attended_count: Number(row["attended_count"] ?? 0),
        attendance_rate_pct:
          row["attendance_rate_pct"] == null ? null : Number(row["attendance_rate_pct"]),
        avg_watch_minutes:
          row["avg_watch_minutes"] == null ? null : Number(row["avg_watch_minutes"]),
        late_count: Number(row["late_count"] ?? 0),
        recording_url: recordingUrl,
        has_recording: recordingUrl != null,
      };
    });
  },

  async summarizeBatchLiveSessions(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    rosterCount: number,
  ): Promise<BatchLiveSessionsSummaryRow> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with sessions as (
        select
          ls.id,
          ls.status,
          ls.scheduled_at,
          ls.ended_at,
          ls.started_at,
          case
            when (ls.metadata_json->>'durationMinutes') ~ '^[0-9]+$'
              then (ls.metadata_json->>'durationMinutes')::int
            when (ls.metadata_json->>'duration_minutes') ~ '^[0-9]+$'
              then (ls.metadata_json->>'duration_minutes')::int
            when ls.started_at is not null and ls.ended_at is not null
              then greatest(1, round(extract(epoch from (ls.ended_at - ls.started_at)) / 60.0)::int)
            else null
          end as planned_minutes,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and lower(la.status) in ('attended', 'present', 'joined', 'partial')
          ) as attended_count,
          (
            select avg(la.duration_seconds)::float
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and lower(la.status) in ('attended', 'present', 'joined', 'partial')
              and la.duration_seconds is not null
          ) as avg_duration_seconds
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ls.batch_id = ${batchId}::uuid
            or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
          )
      ),
      held as (
        select *
        from sessions
        where lower(status) not in ('cancelled', 'canceled')
          and (
            lower(status) in ('ended', 'completed', 'live', 'in_progress')
            or ended_at is not null
            or started_at is not null
            or (scheduled_at is not null and scheduled_at < now())
          )
      ),
      member_misses as (
        select
          bm.membership_id,
          count(*) filter (
            where not exists (
              select 1
              from live_attendance la
              where la.live_session_id = h.id
                and la.tenant_id = current_setting('app.tenant_id', true)::uuid
                and la.membership_id = bm.membership_id
                and lower(la.status) in ('attended', 'present', 'joined', 'partial')
            )
          )::int as missed_count,
          count(*)::int as held_count
        from batch_memberships bm
        cross join held h
        where bm.batch_id = ${batchId}::uuid
        group by bm.membership_id
      )
      select
        (select count(*)::int from sessions) as sessions_total_count,
        (select count(*)::int from held) as sessions_held_count,
        case
          when ${rosterCount}::int > 0 and (select count(*) from held) > 0
          then round(
            (
              select avg(attended_count::numeric / nullif(${rosterCount}::numeric, 0) * 100)
              from held
            )::numeric,
            1
          )::float
          else null
        end as avg_attendance_pct,
        (
          select count(*)::int
          from member_misses
          where held_count > 0 and missed_count = 0
        ) as perfect_attendance_count,
        (
          select count(*)::int
          from member_misses
          where missed_count >= 3
        ) as missed_three_or_more_count,
        (
          select round((avg(avg_duration_seconds) / 60.0)::numeric, 1)::float
          from held
          where avg_duration_seconds is not null
        ) as avg_watch_minutes,
        (
          select round(avg(planned_minutes)::numeric, 0)::int
          from held
          where planned_minutes is not null
        ) as planned_watch_minutes
    `;

    const row = rows[0] ?? {};
    return {
      avg_attendance_pct:
        row["avg_attendance_pct"] == null ? null : Number(row["avg_attendance_pct"]),
      sessions_held_count: Number(row["sessions_held_count"] ?? 0),
      sessions_total_count: Number(row["sessions_total_count"] ?? 0),
      perfect_attendance_count: Number(row["perfect_attendance_count"] ?? 0),
      missed_three_or_more_count: Number(row["missed_three_or_more_count"] ?? 0),
      avg_watch_minutes: row["avg_watch_minutes"] == null ? null : Number(row["avg_watch_minutes"]),
      planned_watch_minutes:
        row["planned_watch_minutes"] == null ? null : Number(row["planned_watch_minutes"]),
      roster_count: rosterCount,
    };
  },

  async listBatchLiveSessionsMatrix(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    query: { q?: string; limitLearners: number; limitSessions: number },
  ): Promise<{
    sessions: Array<{
      id: string;
      title: string;
      scheduled_at: Date | null;
      status: string;
    }>;
    learners: Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
      cells: Array<{
        live_session_id: string;
        kind: "attended" | "partial" | "absent" | "upcoming" | "cancelled" | "none";
      }>;
      attended_count: number;
      missed_count: number;
    }>;
  }> {
    const sessionRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as id,
        ls.title,
        ls.scheduled_at,
        ls.status,
        ls.ended_at,
        ls.started_at
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ls.batch_id = ${batchId}::uuid
          or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
        )
        and (
          ${query.q ?? null}::text is null
          or lower(ls.title) like '%' || lower(${query.q ?? null}) || '%'
        )
      order by coalesce(ls.scheduled_at, ls.created_at) asc
      limit ${query.limitSessions}
    `;

    const sessions = sessionRows.map((row) => ({
      id: asUnknownString(row["id"]),
      title: asUnknownString(row["title"], "Live session"),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      status: asUnknownString(row["status"], "scheduled"),
    }));

    if (sessions.length === 0) {
      return { sessions: [], learners: [] };
    }

    const sessionIds = sessions.map((s) => s.id);

    const learnerRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        bm.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email
      from batch_memberships bm
      join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where bm.batch_id = ${batchId}::uuid
      order by lower(coalesce(
        mp.display_name,
        ap.email,
        m.invited_email_normalized,
        bm.membership_id::text
      )) asc
      limit ${query.limitLearners}
    `;

    const attendanceRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        la.membership_id::text as membership_id,
        la.live_session_id::text as live_session_id,
        lower(la.status) as status,
        la.duration_seconds
      from live_attendance la
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.live_session_id = any(${sessionIds}::uuid[])
    `;

    const attendanceByMember = new Map<
      string,
      Map<string, { status: string; duration: number | null }>
    >();
    for (const row of attendanceRows) {
      const membershipId = asUnknownString(row["membership_id"]);
      const sessionId = asUnknownString(row["live_session_id"]);
      const bucket =
        attendanceByMember.get(membershipId) ??
        new Map<string, { status: string; duration: number | null }>();
      bucket.set(sessionId, {
        status: asUnknownString(row["status"], ""),
        duration: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
      });
      attendanceByMember.set(membershipId, bucket);
    }

    const now = Date.now();
    const learners = learnerRows.map((row) => {
      const membershipId = asUnknownString(row["membership_id"]);
      const memberAttendance =
        attendanceByMember.get(membershipId) ??
        new Map<string, { status: string; duration: number | null }>();
      let attendedCount = 0;
      let missedCount = 0;
      const cells = sessions.map((session) => {
        const statusLower = session.status.toLowerCase();
        const isCancelled = statusLower === "cancelled" || statusLower === "canceled";
        const isUpcoming =
          !isCancelled &&
          (statusLower === "scheduled" ||
            statusLower === "upcoming" ||
            (session.scheduled_at != null &&
              session.scheduled_at.getTime() >= now &&
              statusLower !== "ended" &&
              statusLower !== "completed"));

        if (isCancelled) {
          return { live_session_id: session.id, kind: "cancelled" as const };
        }
        if (isUpcoming) {
          return { live_session_id: session.id, kind: "upcoming" as const };
        }

        const attendance = memberAttendance.get(session.id);
        if (!attendance) {
          missedCount += 1;
          return { live_session_id: session.id, kind: "absent" as const };
        }
        if (attendance.status === "partial") {
          attendedCount += 1;
          return { live_session_id: session.id, kind: "partial" as const };
        }
        if (["attended", "present", "joined"].includes(attendance.status)) {
          attendedCount += 1;
          return { live_session_id: session.id, kind: "attended" as const };
        }
        if (["absent", "missed", "no_show"].includes(attendance.status)) {
          missedCount += 1;
          return { live_session_id: session.id, kind: "absent" as const };
        }
        missedCount += 1;
        return { live_session_id: session.id, kind: "absent" as const };
      });

      return {
        membership_id: membershipId,
        learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
        email: typeof row["email"] === "string" ? row["email"] : null,
        cells,
        attended_count: attendedCount,
        missed_count: missedCount,
      };
    });

    return { sessions, learners };
  },

  async listBatchLiveSessionAbsenteeMembershipIds(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    minMissed: number,
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      with held as (
        select ls.id
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ls.batch_id = ${batchId}::uuid
            or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
          )
          and lower(ls.status) not in ('cancelled', 'canceled')
          and (
            lower(ls.status) in ('ended', 'completed', 'live', 'in_progress')
            or ls.ended_at is not null
            or ls.started_at is not null
            or (ls.scheduled_at is not null and ls.scheduled_at < now())
          )
      ),
      member_misses as (
        select
          bm.membership_id,
          count(*) filter (
            where not exists (
              select 1
              from live_attendance la
              where la.live_session_id = h.id
                and la.tenant_id = current_setting('app.tenant_id', true)::uuid
                and la.membership_id = bm.membership_id
                and lower(la.status) in ('attended', 'present', 'joined', 'partial')
            )
          )::int as missed_count
        from batch_memberships bm
        cross join held h
        where bm.batch_id = ${batchId}::uuid
        group by bm.membership_id
      )
      select membership_id::text as membership_id
      from member_misses
      where missed_count >= ${minMissed}
      order by missed_count desc, membership_id
    `;
    return rows.map((row) => row.membership_id);
  },

  async findBatchLiveSession(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    sessionId: string,
  ): Promise<BatchLiveSessionDetailRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as id,
        ls.title,
        ls.status,
        ls.batch_id::text as batch_id,
        ls.course_id::text as course_id,
        ls.scheduled_at,
        ls.started_at,
        ls.ended_at,
        coalesce(ls.metadata_json->>'kind', ls.metadata_json->>'type', null) as session_kind,
        coalesce(
          nullif(ls.metadata_json->>'host', ''),
          nullif(ls.metadata_json->>'hostName', ''),
          nullif(ls.metadata_json->>'host_label', ''),
          nullif(ls.metadata_json->>'instructor', ''),
          null
        ) as host_label,
        coalesce(
          nullif(ls.metadata_json->>'recordingUrl', ''),
          nullif(ls.metadata_json->>'recording_url', ''),
          nullif(ls.metadata_json->>'recording', ''),
          null
        ) as recording_url,
        coalesce(
          nullif(ls.metadata_json->>'timezone', ''),
          nullif(ls.metadata_json->>'timezoneLabel', ''),
          null
        ) as timezone_label,
        case
          when (ls.metadata_json->>'durationMinutes') ~ '^[0-9]+$'
            then (ls.metadata_json->>'durationMinutes')::int
          when (ls.metadata_json->>'duration_minutes') ~ '^[0-9]+$'
            then (ls.metadata_json->>'duration_minutes')::int
          else null
        end as planned_duration_minutes,
        case
          when ls.started_at is not null and ls.ended_at is not null
            then greatest(1, round(extract(epoch from (ls.ended_at - ls.started_at)) / 60.0)::int)
          else null
        end as actual_duration_minutes
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.id = ${sessionId}::uuid
        and (
          ls.batch_id = ${batchId}::uuid
          or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
        )
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    const recordingUrl =
      typeof row["recording_url"] === "string" && row["recording_url"].length > 0
        ? row["recording_url"]
        : null;
    return {
      id: asUnknownString(row["id"]),
      title: asUnknownString(row["title"], "Live session"),
      kind: typeof row["session_kind"] === "string" ? row["session_kind"] : null,
      status: asUnknownString(row["status"], "scheduled"),
      host_label: typeof row["host_label"] === "string" ? row["host_label"] : null,
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
      ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
      planned_duration_minutes:
        row["planned_duration_minutes"] == null ? null : Number(row["planned_duration_minutes"]),
      actual_duration_minutes:
        row["actual_duration_minutes"] == null ? null : Number(row["actual_duration_minutes"]),
      recording_url: recordingUrl,
      timezone_label: typeof row["timezone_label"] === "string" ? row["timezone_label"] : null,
      batch_id: typeof row["batch_id"] === "string" ? row["batch_id"] : null,
      course_id: typeof row["course_id"] === "string" ? row["course_id"] : null,
    };
  },

  async findNextBatchLiveSession(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    afterAt: Date | null,
    excludeSessionId: string,
  ): Promise<{ id: string; title: string; scheduled_at: Date | null } | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as id,
        ls.title,
        ls.scheduled_at
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.id <> ${excludeSessionId}::uuid
        and (
          ls.batch_id = ${batchId}::uuid
          or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
        )
        and lower(ls.status) not in ('cancelled', 'canceled')
        and (
          ${afterAt ?? null}::timestamptz is null
          or coalesce(ls.scheduled_at, ls.created_at) > ${afterAt ?? null}::timestamptz
        )
      order by coalesce(ls.scheduled_at, ls.created_at) asc
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: asUnknownString(row["id"]),
      title: asUnknownString(row["title"], "Live session"),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
    };
  },

  async listBatchLiveSessionIntervals(
    tx: TenantTx,
    sessionId: string,
  ): Promise<BatchLiveSessionIntervalRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        la.membership_id::text as membership_id,
        la.joined_at,
        la.left_at,
        la.duration_seconds
      from live_attendance la
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.live_session_id = ${sessionId}::uuid
        and la.joined_at is not null
        and lower(la.status) in ('attended', 'present', 'joined', 'partial', 'excused')
    `;
    return rows
      .filter((row) => row["joined_at"] instanceof Date)
      .map((row) => ({
        membership_id: asUnknownString(row["membership_id"]),
        joined_at: row["joined_at"] as Date,
        left_at: row["left_at"] instanceof Date ? row["left_at"] : null,
        duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
      }));
  },

  async countBatchLiveSessionAttendees(
    tx: TenantTx,
    batchId: string,
    sessionId: string,
    query: {
      q?: string | undefined;
      attendanceKind: "any" | "attended" | "partial" | "absent" | "excused" | "upcoming";
      plannedSeconds: number | null;
      sessionStart: Date | null;
      sessionEnd: Date | null;
      isUpcoming: boolean;
      isCancelled: boolean;
    },
  ): Promise<number> {
    const rows = await this.listBatchLiveSessionAttendeeRows(tx, batchId, sessionId, {
      ...(query.q !== undefined ? { q: query.q } : {}),
      attendanceKind: "any",
      sortBy: "learner_name",
      sortDir: "asc",
      page: 1,
      limit: 5000,
      plannedSeconds: query.plannedSeconds,
      sessionStart: query.sessionStart,
      sessionEnd: query.sessionEnd,
      isUpcoming: query.isUpcoming,
      isCancelled: query.isCancelled,
    });
    if (query.attendanceKind === "any") return rows.length;
    return rows.filter((row) => row.attendance_kind === query.attendanceKind).length;
  },

  async listBatchLiveSessionAttendeeRows(
    tx: TenantTx,
    batchId: string,
    sessionId: string,
    query: {
      q?: string;
      attendanceKind: "any" | "attended" | "partial" | "absent" | "excused" | "upcoming";
      sortBy: "learner_name" | "joined_at" | "left_at" | "watch_pct" | "status" | "rejoins";
      sortDir: "asc" | "desc";
      page: number;
      limit: number;
      plannedSeconds: number | null;
      sessionStart: Date | null;
      sessionEnd: Date | null;
      isUpcoming: boolean;
      isCancelled: boolean;
    },
  ): Promise<
    Array<
      BatchLiveSessionAttendeeRow & {
        attendance_kind: "attended" | "partial" | "absent" | "excused" | "upcoming";
        health_rail: "none" | "warning" | "danger";
        watch_pct: number | null;
        late: boolean;
        left_early: boolean;
      }
    >
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        bm.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        la.status as raw_status,
        la.joined_at,
        la.left_at,
        la.duration_seconds,
        null::int as rejoins,
        null::text as device_label
      from batch_memberships bm
      join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join live_attendance la
        on la.membership_id = bm.membership_id
        and la.live_session_id = ${sessionId}::uuid
        and la.tenant_id = bm.tenant_id
      where bm.batch_id = ${batchId}::uuid
        and (
          ${query.q ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.q ?? null}) || '%'
        )
    `;

    const ATTENDED_MIN = 0.9;
    const PARTIAL_MIN = 0.1;
    const WARNING_MAX = 0.5;
    const LATE_GRACE_MS = 5 * 60 * 1000;
    const EARLY_LEAVE_MS = 5 * 60 * 1000;

    const mapped = rows.map((row) => {
      const rawStatus =
        typeof row["raw_status"] === "string" ? row["raw_status"].toLowerCase() : null;
      const joinedAt = row["joined_at"] instanceof Date ? row["joined_at"] : null;
      const leftAt = row["left_at"] instanceof Date ? row["left_at"] : null;
      const durationSeconds =
        row["duration_seconds"] == null ? null : Number(row["duration_seconds"]);
      const plannedSeconds = query.plannedSeconds;

      let attendance_kind: "attended" | "partial" | "absent" | "excused" | "upcoming" = "absent";
      if (query.isCancelled) {
        attendance_kind = "absent";
      } else if (query.isUpcoming && !joinedAt && !rawStatus) {
        attendance_kind = "upcoming";
      } else if (rawStatus === "excused") {
        attendance_kind = "excused";
      } else if (rawStatus === "absent" || rawStatus === "missed" || rawStatus === "no_show") {
        attendance_kind = "absent";
      } else if (joinedAt || (durationSeconds != null && durationSeconds > 0)) {
        const watchPct =
          plannedSeconds && plannedSeconds > 0 && durationSeconds != null
            ? durationSeconds / plannedSeconds
            : durationSeconds != null && durationSeconds > 0
              ? 1
              : 0;
        if (watchPct >= ATTENDED_MIN) attendance_kind = "attended";
        else if (watchPct >= PARTIAL_MIN) attendance_kind = "partial";
        else if (rawStatus && ["attended", "present", "joined", "partial"].includes(rawStatus)) {
          attendance_kind = watchPct > 0 ? "partial" : "absent";
        } else {
          attendance_kind = "absent";
        }
      }

      const watchPct =
        plannedSeconds && plannedSeconds > 0 && durationSeconds != null
          ? Math.round((durationSeconds / plannedSeconds) * 1000) / 10
          : null;

      let health_rail: "none" | "warning" | "danger" = "none";
      if (attendance_kind === "absent") health_rail = "danger";
      else if (watchPct != null && watchPct < WARNING_MAX * 100) health_rail = "warning";

      const late =
        Boolean(joinedAt && query.sessionStart) &&
        defined(joinedAt).getTime() > defined(query.sessionStart).getTime() + LATE_GRACE_MS;
      const left_early =
        Boolean(leftAt && query.sessionEnd) &&
        defined(leftAt).getTime() < defined(query.sessionEnd).getTime() - EARLY_LEAVE_MS;

      return {
        membership_id: asUnknownString(row["membership_id"]),
        learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
        email: typeof row["email"] === "string" ? row["email"] : null,
        raw_status: rawStatus,
        joined_at: joinedAt,
        left_at: leftAt,
        duration_seconds: durationSeconds,
        rejoins: row["rejoins"] == null ? null : Number(row["rejoins"]),
        device_label: typeof row["device_label"] === "string" ? row["device_label"] : null,
        attendance_kind,
        health_rail,
        watch_pct: watchPct,
        late,
        left_early,
      };
    });

    const filtered =
      query.attendanceKind === "any"
        ? mapped
        : mapped.filter((row) => row.attendance_kind === query.attendanceKind);

    const kindOrder: Record<string, number> = {
      absent: 0,
      partial: 1,
      attended: 2,
      excused: 3,
      upcoming: 4,
    };

    filtered.sort((a, b) => {
      const dir = query.sortDir === "asc" ? 1 : -1;
      const cmp = (left: number | string | null, right: number | string | null) => {
        if (left == null && right == null) return 0;
        if (left == null) return 1;
        if (right == null) return -1;
        if (left < right) return -1 * dir;
        if (left > right) return 1 * dir;
        return 0;
      };
      if (query.sortBy === "joined_at") {
        return cmp(a.joined_at?.getTime() ?? null, b.joined_at?.getTime() ?? null);
      }
      if (query.sortBy === "left_at") {
        return cmp(a.left_at?.getTime() ?? null, b.left_at?.getTime() ?? null);
      }
      if (query.sortBy === "watch_pct") {
        return cmp(a.watch_pct, b.watch_pct);
      }
      if (query.sortBy === "rejoins") {
        return cmp(a.rejoins, b.rejoins);
      }
      if (query.sortBy === "status") {
        const byKind = (kindOrder[a.attendance_kind] ?? 9) - (kindOrder[b.attendance_kind] ?? 9);
        if (byKind !== 0) return byKind * dir;
        return cmp(
          (a.learner_name ?? a.email ?? "").toLowerCase(),
          (b.learner_name ?? b.email ?? "").toLowerCase(),
        );
      }
      return cmp(
        (a.learner_name ?? a.email ?? "").toLowerCase(),
        (b.learner_name ?? b.email ?? "").toLowerCase(),
      );
    });

    const skip = (query.page - 1) * query.limit;
    return filtered.slice(skip, skip + query.limit);
  },

  async listBatchExamAssessments(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    rosterCount: number,
    query: {
      q?: string;
      sortBy: "released_at" | "title" | "attempted_pct" | "avg_score" | "pass_rate";
      sortDir: "asc" | "desc";
    },
  ): Promise<BatchExamAssessmentRow[]> {
    if (!courseId) return [];

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with roster as (
        select bm.membership_id
        from batch_memberships bm
        where bm.batch_id = ${batchId}::uuid
      ),
      base as (
        select
          a.id as assessment_id,
          a.title,
          a.assessment_type,
          a.created_at as released_at,
          coalesce(nullif(a.config_json->>'passMarkPercent', '')::float, 70)::float as pass_mark
        from assessments a
        join lessons l on l.tenant_id = a.tenant_id
          and l.deleted_at is null
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
          and cm.course_id = ${courseId}::uuid
          and (
            ${query.q ?? null}::text is null
            or lower(a.title) like '%' || lower(${query.q ?? null}) || '%'
          )
        group by a.id, a.title, a.assessment_type, a.created_at, a.config_json
      ),
      latest as (
        select distinct on (b.assessment_id, at.membership_id)
          b.assessment_id,
          at.membership_id,
          at.score_pct,
          at.status::text as attempt_status,
          b.pass_mark
        from base b
        join attempts at
          on at.assessment_id = b.assessment_id
          and at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.status::text <> 'VOIDED'
          and exists (select 1 from roster r where r.membership_id = at.membership_id)
        order by b.assessment_id, at.membership_id,
          coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      ),
      scored as (
        select
          assessment_id,
          score_pct
        from latest
        where score_pct is not null
      ),
      metrics as (
        select
          b.assessment_id::text as assessment_id,
          b.title,
          b.assessment_type,
          b.released_at,
          b.pass_mark as pass_mark_pct,
          ${rosterCount}::int as roster_count,
          (
            select count(distinct l.membership_id)::int
            from latest l
            where l.assessment_id = b.assessment_id
          ) as attempted_count,
          (
            select round(avg(s.score_pct)::numeric, 1)::float
            from scored s
            where s.assessment_id = b.assessment_id
          ) as avg_score_pct,
          (
            select
              case
                when count(*) = 0 then null
                else round(
                  (
                    count(*) filter (where s.score_pct >= b.pass_mark)::numeric
                    / count(*)::numeric
                  ) * 100,
                  1
                )::float
              end
            from scored s
            where s.assessment_id = b.assessment_id
          ) as pass_rate_pct,
          (
            select max(s.score_pct)::float
            from scored s
            where s.assessment_id = b.assessment_id
          ) as high_score_pct,
          (
            select min(s.score_pct)::float
            from scored s
            where s.assessment_id = b.assessment_id
          ) as low_score_pct,
          (
            select count(*)::int
            from latest l
            where l.assessment_id = b.assessment_id
              and l.attempt_status = 'SUBMITTED'
              and l.score_pct is null
          ) as awaiting_grading_count,
          (
            select percentile_cont(0.25) within group (order by s.score_pct)
            from scored s
            where s.assessment_id = b.assessment_id
          )::float as q1,
          (
            select percentile_cont(0.5) within group (order by s.score_pct)
            from scored s
            where s.assessment_id = b.assessment_id
          )::float as median,
          (
            select percentile_cont(0.75) within group (order by s.score_pct)
            from scored s
            where s.assessment_id = b.assessment_id
          )::float as q3
        from base b
      )
      select *
      from metrics
      order by
        case when ${query.sortBy} = 'title' and ${query.sortDir} = 'asc' then title end asc nulls last,
        case when ${query.sortBy} = 'title' and ${query.sortDir} = 'desc' then title end desc nulls last,
        case
          when ${query.sortBy} = 'attempted_pct' and ${query.sortDir} = 'asc'
          then case when ${rosterCount}::int > 0 then attempted_count::numeric / ${rosterCount}::numeric else null end
        end asc nulls last,
        case
          when ${query.sortBy} = 'attempted_pct' and ${query.sortDir} = 'desc'
          then case when ${rosterCount}::int > 0 then attempted_count::numeric / ${rosterCount}::numeric else null end
        end desc nulls last,
        case when ${query.sortBy} = 'avg_score' and ${query.sortDir} = 'asc' then avg_score_pct end asc nulls last,
        case when ${query.sortBy} = 'avg_score' and ${query.sortDir} = 'desc' then avg_score_pct end desc nulls last,
        case when ${query.sortBy} = 'pass_rate' and ${query.sortDir} = 'asc' then pass_rate_pct end asc nulls last,
        case when ${query.sortBy} = 'pass_rate' and ${query.sortDir} = 'desc' then pass_rate_pct end desc nulls last,
        case when ${query.sortBy} = 'released_at' and ${query.sortDir} = 'asc' then released_at end asc nulls last,
        case when ${query.sortBy} = 'released_at' and ${query.sortDir} = 'desc' then released_at end desc nulls last,
        released_at asc nulls last
    `;

    return rows.map((row) => {
      const passRate = row["pass_rate_pct"] == null ? null : Number(row["pass_rate_pct"]);
      const passMark = row["pass_mark_pct"] == null ? 70 : Number(row["pass_mark_pct"]);
      let health_rail: "none" | "success" | "warning" | "danger" = "none";
      if (passRate != null) {
        if (passRate >= 70) health_rail = "success";
        else if (passRate >= 50) health_rail = "warning";
        else health_rail = "danger";
      } else if (Number(row["awaiting_grading_count"] ?? 0) > 0) {
        health_rail = "warning";
      }

      const attempted = Number(row["attempted_count"] ?? 0);
      return {
        assessment_id: asUnknownString(row["assessment_id"]),
        title: asUnknownString(row["title"], "Assessment"),
        assessment_type: asUnknownString(row["assessment_type"], "QUIZ"),
        released_at: row["released_at"] instanceof Date ? row["released_at"] : null,
        pass_mark_pct: passMark,
        roster_count: rosterCount,
        attempted_count: attempted,
        attempted_pct: rosterCount > 0 ? Math.round((attempted / rosterCount) * 1000) / 10 : null,
        avg_score_pct: row["avg_score_pct"] == null ? null : Number(row["avg_score_pct"]),
        pass_rate_pct: passRate,
        high_score_pct: row["high_score_pct"] == null ? null : Number(row["high_score_pct"]),
        low_score_pct: row["low_score_pct"] == null ? null : Number(row["low_score_pct"]),
        awaiting_grading_count: Number(row["awaiting_grading_count"] ?? 0),
        health_rail,
        dist_min: row["low_score_pct"] == null ? null : Number(row["low_score_pct"]),
        dist_q1: row["q1"] == null ? null : Number(row["q1"]),
        dist_median: row["median"] == null ? null : Number(row["median"]),
        dist_q3: row["q3"] == null ? null : Number(row["q3"]),
        dist_max: row["high_score_pct"] == null ? null : Number(row["high_score_pct"]),
      };
    });
  },

  async summarizeBatchExams(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    rosterCount: number,
  ): Promise<BatchExamsSummaryRow> {
    if (!courseId) {
      return {
        avg_score_pct: null,
        pass_mark_pct: 70,
        pass_rate_pct: null,
        passed_learner_count: 0,
        roster_count: rosterCount,
        attempt_count: 0,
        attempts_per_learner: null,
        awaiting_grading_count: 0,
        not_attempted_count: rosterCount,
        assessment_count: 0,
      };
    }

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with roster as (
        select bm.membership_id
        from batch_memberships bm
        where bm.batch_id = ${batchId}::uuid
      ),
      assessments as (
        select distinct a.id as assessment_id,
          coalesce(nullif(a.config_json->>'passMarkPercent', '')::float, 70)::float as pass_mark
        from assessments a
        join lessons l on l.tenant_id = a.tenant_id
          and l.deleted_at is null
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
          and cm.course_id = ${courseId}::uuid
      ),
      latest as (
        select distinct on (a.assessment_id, at.membership_id)
          a.assessment_id,
          at.membership_id,
          at.score_pct,
          at.status::text as attempt_status,
          a.pass_mark
        from assessments a
        join attempts at
          on at.assessment_id = a.assessment_id
          and at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.status::text <> 'VOIDED'
          and exists (select 1 from roster r where r.membership_id = at.membership_id)
        order by a.assessment_id, at.membership_id,
          coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      ),
      learner_avg as (
        select
          membership_id,
          avg(score_pct) filter (where score_pct is not null) as avg_score
        from latest
        group by membership_id
      ),
      all_attempts as (
        select count(*)::int as attempt_count
        from attempts at
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.status::text <> 'VOIDED'
          and exists (select 1 from roster r where r.membership_id = at.membership_id)
          and exists (select 1 from assessments a where a.assessment_id = at.assessment_id)
      )
      select
        (select count(*)::int from assessments) as assessment_count,
        (select attempt_count from all_attempts) as attempt_count,
        (
          select coalesce(round(avg(a.pass_mark)::numeric, 0)::float, 70)
          from assessments a
        ) as pass_mark_pct,
        (
          select round(avg(la.avg_score)::numeric, 1)::float
          from learner_avg la
          where la.avg_score is not null
        ) as avg_score_pct,
        (
          select count(*)::int
          from learner_avg la
          where la.avg_score is not null
            and la.avg_score >= (
              select coalesce(avg(a.pass_mark), 70) from assessments a
            )
        ) as passed_learner_count,
        (
          select count(*)::int
          from latest l
          where l.attempt_status = 'SUBMITTED' and l.score_pct is null
        ) as awaiting_grading_count,
        (
          select count(*)::int
          from roster r
          where not exists (
            select 1 from latest l where l.membership_id = r.membership_id
          )
        ) as not_attempted_count
    `;

    const row = rows[0] ?? {};
    const attemptCount = Number(row["attempt_count"] ?? 0);
    const passed = Number(row["passed_learner_count"] ?? 0);
    const passMarkPct = Number(row["pass_mark_pct"] ?? 70);
    const learnersWithScores = await tx.$queryRaw<Array<{ count: number }>>`
      with roster as (
        select bm.membership_id from batch_memberships bm where bm.batch_id = ${batchId}::uuid
      ),
      assessments as (
        select distinct a.id as assessment_id
        from assessments a
        join lessons l on l.tenant_id = a.tenant_id and l.deleted_at is null
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
          and cm.course_id = ${courseId}::uuid
      ),
      latest as (
        select distinct on (a.assessment_id, at.membership_id)
          at.membership_id,
          at.score_pct
        from assessments a
        join attempts at on at.assessment_id = a.assessment_id
          and at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.status::text <> 'VOIDED'
          and exists (select 1 from roster r where r.membership_id = at.membership_id)
        order by a.assessment_id, at.membership_id,
          coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      ),
      learner_avg as (
        select membership_id, avg(score_pct) filter (where score_pct is not null) as avg_score
        from latest
        group by membership_id
        having avg(score_pct) filter (where score_pct is not null) is not null
      )
      select count(*)::int as count from learner_avg
    `;
    const withScores = learnersWithScores[0]?.count ?? 0;

    return {
      avg_score_pct: row["avg_score_pct"] == null ? null : Number(row["avg_score_pct"]),
      pass_mark_pct: passMarkPct,
      pass_rate_pct: withScores > 0 ? Math.round((passed / withScores) * 1000) / 10 : null,
      passed_learner_count: passed,
      roster_count: rosterCount,
      attempt_count: attemptCount,
      attempts_per_learner:
        rosterCount > 0 ? Math.round((attemptCount / rosterCount) * 10) / 10 : null,
      awaiting_grading_count: Number(row["awaiting_grading_count"] ?? 0),
      not_attempted_count: Number(row["not_attempted_count"] ?? 0),
      assessment_count: Number(row["assessment_count"] ?? 0),
    };
  },

  async listBatchExamsMatrix(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    query: { q?: string; limitLearners: number },
  ): Promise<{
    assessments: Array<{
      assessment_id: string;
      title: string;
      avg_score_pct: number | null;
    }>;
    learners: Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
      cells: Array<{
        assessment_id: string;
        kind: "passed" | "failed" | "awaiting" | "not_attempted";
        score_pct: number | null;
        attempt_count: number;
      }>;
      avg_score_pct: number | null;
      health_rail: "none" | "success" | "warning" | "danger";
    }>;
    pass_mark_pct: number;
  }> {
    if (!courseId) {
      return { assessments: [], learners: [], pass_mark_pct: 70 };
    }

    const assessmentRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        a.id::text as assessment_id,
        a.title,
        coalesce(nullif(a.config_json->>'passMarkPercent', '')::float, 70)::float as pass_mark
      from assessments a
      join lessons l on l.tenant_id = a.tenant_id
        and l.deleted_at is null
        and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
      join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
      where a.tenant_id = current_setting('app.tenant_id', true)::uuid
        and a.deleted_at is null
        and cm.course_id = ${courseId}::uuid
      group by a.id, a.title, a.config_json, a.created_at
      order by a.created_at asc
      limit 40
    `;

    const assessmentsMeta = assessmentRows.map((row) => ({
      assessment_id: asUnknownString(row["assessment_id"]),
      title: asUnknownString(row["title"], "Assessment"),
      pass_mark: Number(row["pass_mark"] ?? 70),
    }));

    if (assessmentsMeta.length === 0) {
      return { assessments: [], learners: [], pass_mark_pct: 70 };
    }

    const assessmentIds = assessmentsMeta.map((a) => a.assessment_id);

    const learnerRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        bm.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email
      from batch_memberships bm
      join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where bm.batch_id = ${batchId}::uuid
        and (
          ${query.q ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.q ?? null}) || '%'
        )
      order by lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, bm.membership_id::text))
      limit ${query.limitLearners}
    `;

    const attemptRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        at.membership_id::text as membership_id,
        at.assessment_id::text as assessment_id,
        at.score_pct,
        at.status::text as attempt_status,
        count(*) over (partition by at.membership_id, at.assessment_id) as attempt_count,
        row_number() over (
          partition by at.membership_id, at.assessment_id
          order by coalesce(at.submitted_at, at.graded_at, at.started_at) desc
        ) as rn
      from attempts at
      where at.tenant_id = current_setting('app.tenant_id', true)::uuid
        and at.status::text <> 'VOIDED'
        and at.assessment_id = any(${assessmentIds}::uuid[])
        and exists (
          select 1 from batch_memberships bm
          where bm.batch_id = ${batchId}::uuid and bm.membership_id = at.membership_id
        )
    `;

    const latestByMember = new Map<
      string,
      Map<string, { score: number | null; status: string; attempts: number }>
    >();
    for (const row of attemptRows) {
      if (Number(row["rn"]) !== 1) continue;
      const membershipId = asUnknownString(row["membership_id"]);
      const assessmentId = asUnknownString(row["assessment_id"]);
      const bucket =
        latestByMember.get(membershipId) ??
        new Map<string, { score: number | null; status: string; attempts: number }>();
      bucket.set(assessmentId, {
        score: row["score_pct"] == null ? null : Number(row["score_pct"]),
        status: asUnknownString(row["attempt_status"], ""),
        attempts: Number(row["attempt_count"] ?? 1),
      });
      latestByMember.set(membershipId, bucket);
    }

    const assessmentAvgs = new Map<string, number | null>();
    for (const assessment of assessmentsMeta) {
      const scores: number[] = [];
      for (const [, cells] of latestByMember) {
        const cell = cells.get(assessment.assessment_id);
        if (cell?.score != null) scores.push(cell.score);
      }
      assessmentAvgs.set(
        assessment.assessment_id,
        scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null,
      );
    }

    const passMark = 70;
    const learners = learnerRows.map((row) => {
      const membershipId = asUnknownString(row["membership_id"]);
      const memberAttempts =
        latestByMember.get(membershipId) ??
        new Map<string, { score: number | null; status: string; attempts: number }>();
      const scores: number[] = [];
      const cells = assessmentsMeta.map((assessment) => {
        const attempt = memberAttempts.get(assessment.assessment_id);
        if (!attempt) {
          return {
            assessment_id: assessment.assessment_id,
            kind: "not_attempted" as const,
            score_pct: null,
            attempt_count: 0,
          };
        }
        if (attempt.score == null) {
          return {
            assessment_id: assessment.assessment_id,
            kind: "awaiting" as const,
            score_pct: null,
            attempt_count: attempt.attempts,
          };
        }
        scores.push(attempt.score);
        return {
          assessment_id: assessment.assessment_id,
          kind: attempt.score >= assessment.pass_mark ? ("passed" as const) : ("failed" as const),
          score_pct: attempt.score,
          attempt_count: attempt.attempts,
        };
      });
      const avg =
        scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null;
      let health_rail: "none" | "success" | "warning" | "danger" = "none";
      if (avg != null) {
        if (avg >= passMark) health_rail = "success";
        else if (avg >= passMark - 15) health_rail = "warning";
        else health_rail = "danger";
      }

      return {
        membership_id: membershipId,
        learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
        email: typeof row["email"] === "string" ? row["email"] : null,
        cells,
        avg_score_pct: avg,
        health_rail,
      };
    });

    return {
      assessments: assessmentsMeta.map((a) => ({
        assessment_id: a.assessment_id,
        title: a.title,
        avg_score_pct: assessmentAvgs.get(a.assessment_id) ?? null,
      })),
      learners,
      pass_mark_pct: passMark,
    };
  },

  async listBatchExamsBelowPassMembershipIds(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    passMarkPct = 70,
  ): Promise<string[]> {
    if (!courseId) return [];

    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      with roster as (
        select bm.membership_id
        from batch_memberships bm
        where bm.batch_id = ${batchId}::uuid
      ),
      assessments as (
        select distinct a.id as assessment_id
        from assessments a
        join lessons l on l.tenant_id = a.tenant_id and l.deleted_at is null
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
          and cm.course_id = ${courseId}::uuid
      ),
      latest as (
        select distinct on (a.assessment_id, at.membership_id)
          at.membership_id,
          at.score_pct
        from assessments a
        join attempts at on at.assessment_id = a.assessment_id
          and at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.status::text <> 'VOIDED'
          and exists (select 1 from roster r where r.membership_id = at.membership_id)
        order by a.assessment_id, at.membership_id,
          coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      ),
      learner_avg as (
        select
          membership_id,
          avg(score_pct) filter (where score_pct is not null) as avg_score
        from latest
        group by membership_id
      )
      select membership_id::text as membership_id
      from learner_avg
      where avg_score is not null and avg_score < ${passMarkPct}
      order by avg_score asc
    `;
    return rows.map((row) => row.membership_id);
  },

  async summarizeBatchContent(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    rosterCount: number,
    stalledDays = 14,
  ): Promise<{
    avg_completion_pct: number | null;
    avg_completed_lessons: number | null;
    total_lessons: number;
    finished_count: number;
    stalled_count: number;
    never_started_count: number;
    median_days_to_finish: number | null;
    band_0_25: number;
    band_26_50: number;
    band_51_75: number;
    band_76_100: number;
  }> {
    if (!courseId) {
      return {
        avg_completion_pct: null,
        avg_completed_lessons: null,
        total_lessons: 0,
        finished_count: 0,
        stalled_count: 0,
        never_started_count: rosterCount,
        median_days_to_finish: null,
        band_0_25: 0,
        band_26_50: 0,
        band_51_75: 0,
        band_76_100: 0,
      };
    }

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with roster as (
        select bm.membership_id, bm.joined_at
        from batch_memberships bm
        where bm.batch_id = ${batchId}::uuid
      ),
      course_lessons as (
        select l.id as lesson_id
        from lessons l
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where cm.course_id = ${courseId}::uuid
          and l.deleted_at is null
          and l.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      totals as (
        select count(*)::int as total_lessons from course_lessons
      ),
      learner_stats as (
        select
          r.membership_id,
          r.joined_at,
          (select total_lessons from totals) as total_lessons,
          (
            select count(*)::int
            from lesson_progress lp
            join course_lessons cl on cl.lesson_id = lp.lesson_id
            where lp.membership_id = r.membership_id
              and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
              and lp.status = 'completed'
          ) as completed_lessons,
          (
            select max(coalesce(lp.completed_at, lp.updated_at, lp.last_seen_at))
            from lesson_progress lp
            join course_lessons cl on cl.lesson_id = lp.lesson_id
            where lp.membership_id = r.membership_id
              and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
          ) as last_activity_at,
          (
            select min(coalesce(lp.completed_at, lp.updated_at, lp.last_seen_at))
            from lesson_progress lp
            join course_lessons cl on cl.lesson_id = lp.lesson_id
            where lp.membership_id = r.membership_id
              and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
              and lp.status = 'completed'
          ) as first_completed_at,
          (
            select max(lp.completed_at)
            from lesson_progress lp
            join course_lessons cl on cl.lesson_id = lp.lesson_id
            where lp.membership_id = r.membership_id
              and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
              and lp.status = 'completed'
          ) as finished_at
        from roster r
      ),
      scored as (
        select
          *,
          case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0
          end as completion_pct
        from learner_stats
      )
      select
        (select total_lessons from totals) as total_lessons,
        (select round(avg(completion_pct)::numeric, 1)::float from scored) as avg_completion_pct,
        (select round(avg(completed_lessons)::numeric, 1)::float from scored) as avg_completed_lessons,
        (select count(*)::int from scored where total_lessons > 0 and completed_lessons >= total_lessons) as finished_count,
        (
          select count(*)::int from scored
          where completion_pct > 0
            and completion_pct < 100
            and (
              last_activity_at is null
              or last_activity_at < now() - make_interval(days => ${stalledDays})
            )
        ) as stalled_count,
        (select count(*)::int from scored where completed_lessons = 0) as never_started_count,
        (
          select percentile_cont(0.5) within group (
            order by extract(epoch from (finished_at - coalesce(first_completed_at, joined_at))) / 86400.0
          )::float
          from scored
          where finished_at is not null and total_lessons > 0 and completed_lessons >= total_lessons
        ) as median_days_to_finish,
        (select count(*)::int from scored where completion_pct between 0 and 25) as band_0_25,
        (select count(*)::int from scored where completion_pct between 26 and 50) as band_26_50,
        (select count(*)::int from scored where completion_pct between 51 and 75) as band_51_75,
        (select count(*)::int from scored where completion_pct between 76 and 100) as band_76_100
    `;

    const row = rows[0] ?? {};
    return {
      avg_completion_pct:
        row["avg_completion_pct"] == null ? null : Number(row["avg_completion_pct"]),
      avg_completed_lessons:
        row["avg_completed_lessons"] == null ? null : Number(row["avg_completed_lessons"]),
      total_lessons: Number(row["total_lessons"] ?? 0),
      finished_count: Number(row["finished_count"] ?? 0),
      stalled_count: Number(row["stalled_count"] ?? 0),
      never_started_count: Number(row["never_started_count"] ?? 0),
      median_days_to_finish:
        row["median_days_to_finish"] == null
          ? null
          : Math.round(Number(row["median_days_to_finish"])),
      band_0_25: Number(row["band_0_25"] ?? 0),
      band_26_50: Number(row["band_26_50"] ?? 0),
      band_51_75: Number(row["band_51_75"] ?? 0),
      band_76_100: Number(row["band_76_100"] ?? 0),
    };
  },

  async listBatchContentFunnel(
    tx: TenantTx,
    batchId: string,
    courseId: string,
    _rosterCount: number,
  ): Promise<
    Array<{
      lesson_id: string;
      module_id: string;
      module_title: string;
      module_position: number;
      lesson_position: number;
      sequence_number: number;
      title: string;
      lesson_type: "video" | "article" | "quiz" | "project" | "interactive" | "other";
      completed_count: number;
      median_duration_seconds: number | null;
    }>
  > {
    void _rosterCount;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with roster as (
        select bm.membership_id
        from batch_memberships bm
        where bm.batch_id = ${batchId}::uuid
      ),
      ordered as (
        select
          l.id as lesson_id,
          cm.id as module_id,
          cm.title as module_title,
          cm.position as module_position,
          l.position as lesson_position,
          l.title,
          l.duration_seconds,
          l.video_url,
          l.video_provider,
          l.content_json,
          coalesce(
            l.content_json->'content'->>'assessmentId',
            l.content_json->>'assessmentId'
          ) as assessment_id_text,
          row_number() over (order by cm.position asc, l.position asc) as sequence_number
        from course_modules cm
        join lessons l on l.module_id = cm.id and l.tenant_id = cm.tenant_id and l.deleted_at is null
        where cm.course_id = ${courseId}::uuid
          and cm.tenant_id = current_setting('app.tenant_id', true)::uuid
          and cm.deleted_at is null
      ),
      typed as (
        select
          o.*,
          case
            when coalesce(o.content_json->>'type', o.content_json->>'lessonType', '') = 'section_quiz'
              or (o.assessment_id_text ~ '^[0-9a-fA-F-]{36}$')
              then 'quiz'
            when coalesce(o.content_json->>'type', o.content_json->>'lessonType', '')
              in ('project', 'assignment')
              then 'project'
            when coalesce(o.content_json->>'type', o.content_json->>'lessonType', '') in ('video', 'audio')
              or nullif(trim(coalesce(o.video_url, '')), '') is not null
              or nullif(trim(coalesce(o.video_provider, '')), '') is not null
              then 'video'
            when coalesce(o.content_json->>'type', o.content_json->>'lessonType', '')
              in ('article', 'text', 'pdf', 'slides')
              then 'article'
            when coalesce(o.content_json->>'type', o.content_json->>'lessonType', '')
              in ('live', 'scorm', 'interactive')
              then 'interactive'
            else 'other'
          end as lesson_type
        from ordered o
      )
      select
        t.lesson_id::text as lesson_id,
        t.module_id::text as module_id,
        t.module_title,
        t.module_position::int as module_position,
        t.lesson_position::int as lesson_position,
        t.sequence_number::int as sequence_number,
        t.title,
        t.lesson_type,
        t.duration_seconds,
        (
          select count(*)::int
          from lesson_progress lp
          join roster r on r.membership_id = lp.membership_id
          where lp.lesson_id = t.lesson_id
            and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
            and lp.status = 'completed'
        ) as completed_count
      from typed t
      order by t.sequence_number asc
    `;

    return rows.map((row) => {
      const typeRaw = asUnknownString(row["lesson_type"], "other");
      const lessonType = (
        ["video", "article", "quiz", "project", "interactive", "other"].includes(typeRaw)
          ? typeRaw
          : "other"
      ) as "video" | "article" | "quiz" | "project" | "interactive" | "other";
      const planned = row["duration_seconds"] == null ? null : Number(row["duration_seconds"]);
      return {
        lesson_id: asUnknownString(row["lesson_id"]),
        module_id: asUnknownString(row["module_id"]),
        module_title: asUnknownString(row["module_title"], "Module"),
        module_position: Number(row["module_position"] ?? 0),
        lesson_position: Number(row["lesson_position"] ?? 0),
        sequence_number: Number(row["sequence_number"] ?? 0),
        title: asUnknownString(row["title"], "Lesson"),
        lesson_type: lessonType,
        completed_count: Number(row["completed_count"] ?? 0),
        median_duration_seconds: planned != null && planned > 0 ? Math.round(planned) : null,
      };
    });
  },

  async listBatchContentPaceSeries(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    startsAt: Date | null,
    endsAt: Date | null,
  ): Promise<
    Array<{
      week_start: Date;
      week_label: string;
      completion_pct: number | null;
      expected_pct: number | null;
    }>
  > {
    if (!courseId) return [];

    const rows = await tx.$queryRaw<Array<{ week_start: Date; avg_completion_pct: number | null }>>`
      with roster as (
        select bm.membership_id
        from batch_memberships bm
        where bm.batch_id = ${batchId}::uuid
      ),
      course_lessons as (
        select l.id as lesson_id
        from lessons l
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where cm.course_id = ${courseId}::uuid and l.deleted_at is null
      ),
      totals as (
        select greatest(count(*)::int, 1) as total_lessons from course_lessons
      ),
      weeks as (
        select generate_series(
          date_trunc('week', coalesce(${startsAt}::timestamptz, now() - interval '4 weeks')),
          date_trunc('week', least(coalesce(${endsAt}::timestamptz, now()), now())),
          interval '1 week'
        )::timestamptz as week_start
      ),
      week_stats as (
        select
          w.week_start,
          (
            select round(avg(
              least(
                100,
                round((
                  (
                    select count(*)::numeric
                    from lesson_progress lp
                    join course_lessons cl on cl.lesson_id = lp.lesson_id
                    where lp.membership_id = r.membership_id
                      and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
                      and lp.status = 'completed'
                      and coalesce(lp.completed_at, lp.updated_at) < w.week_start + interval '1 week'
                  ) / (select total_lessons from totals)::numeric
                ) * 100)
              )
            )::numeric, 1)::float
            from roster r
          ) as avg_completion_pct
        from weeks w
      )
      select week_start, avg_completion_pct
      from week_stats
      order by week_start asc
      limit 12
    `;

    const windowMs = startsAt && endsAt ? Math.max(1, endsAt.getTime() - startsAt.getTime()) : null;

    return rows.map((row) => {
      const weekEnd = new Date(row.week_start.getTime() + 7 * 24 * 60 * 60 * 1000);
      let expected: number | null = null;
      if (windowMs != null && startsAt) {
        const elapsed = Math.min(windowMs, Math.max(0, weekEnd.getTime() - startsAt.getTime()));
        expected = Math.round((elapsed / windowMs) * 1000) / 10;
      }
      const label = row.week_start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return {
        week_start: row.week_start,
        week_label: label,
        completion_pct: row.avg_completion_pct == null ? null : row.avg_completion_pct,
        expected_pct: expected,
      };
    });
  },

  async listBatchContentLearners(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    query: {
      q?: string;
      view: "any" | "stalled" | "never_started" | "finished" | "in_progress";
      sortBy:
        | "learner_name"
        | "completion_pct"
        | "days_since"
        | "projected_finish"
        | "last_activity";
      sortDir: "asc" | "desc";
      limit: number;
      page: number;
    },
    stalledDays = 14,
  ): Promise<{
    items: Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
      completion_pct: number;
      completed_lessons: number;
      total_lessons: number;
      last_lesson_title: string | null;
      last_lesson_sequence: number | null;
      last_activity_at: Date | null;
      days_since_activity: number | null;
      lessons_per_day: number | null;
      joined_at: Date | null;
    }>;
    totalCount: number;
  }> {
    if (!courseId) {
      return { items: [], totalCount: 0 };
    }

    const offset = (query.page - 1) * query.limit;
    const sortDir = query.sortDir === "asc" ? "asc" : "desc";

    const countRows = await tx.$queryRaw<Array<{ count: number }>>`
      with roster as (
        select
          bm.membership_id,
          bm.joined_at,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email
        from batch_memberships bm
        join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where bm.batch_id = ${batchId}::uuid
          and (
            ${query.q ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.q ?? null}) || '%'
          )
      ),
      course_lessons as (
        select l.id as lesson_id,
          row_number() over (order by cm.position asc, l.position asc) as sequence_number,
          l.title
        from lessons l
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where cm.course_id = ${courseId}::uuid and l.deleted_at is null
      ),
      totals as (select count(*)::int as total_lessons from course_lessons),
      scored as (
        select
          r.*,
          (select total_lessons from totals) as total_lessons,
          (
            select count(*)::int
            from lesson_progress lp
            join course_lessons cl on cl.lesson_id = lp.lesson_id
            where lp.membership_id = r.membership_id
              and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
              and lp.status = 'completed'
          ) as completed_lessons,
          (
            select max(coalesce(lp.completed_at, lp.updated_at, lp.last_seen_at))
            from lesson_progress lp
            join course_lessons cl on cl.lesson_id = lp.lesson_id
            where lp.membership_id = r.membership_id
              and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
          ) as last_activity_at
        from roster r
      ),
      labeled as (
        select
          *,
          case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0
          end as completion_pct,
          case
            when total_lessons > 0 and completed_lessons >= total_lessons then 'finished'
            when completed_lessons = 0 then 'never_started'
            when last_activity_at is null
              or last_activity_at < now() - make_interval(days => ${stalledDays})
              then 'stalled'
            else 'in_progress'
          end as activity_status
        from scored
      )
      select count(*)::int as count
      from labeled
      where ${query.view}::text = 'any' or activity_status = ${query.view}::text
    `;

    const totalCount = countRows[0]?.count ?? 0;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with roster as (
        select
          bm.membership_id,
          bm.joined_at,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email
        from batch_memberships bm
        join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where bm.batch_id = ${batchId}::uuid
          and (
            ${query.q ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.q ?? null}) || '%'
          )
      ),
      course_lessons as (
        select l.id as lesson_id,
          row_number() over (order by cm.position asc, l.position asc) as sequence_number,
          l.title
        from lessons l
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where cm.course_id = ${courseId}::uuid and l.deleted_at is null
      ),
      totals as (select count(*)::int as total_lessons from course_lessons),
      scored as (
        select
          r.*,
          (select total_lessons from totals) as total_lessons,
          (
            select count(*)::int
            from lesson_progress lp
            join course_lessons cl on cl.lesson_id = lp.lesson_id
            where lp.membership_id = r.membership_id
              and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
              and lp.status = 'completed'
          ) as completed_lessons,
          (
            select max(coalesce(lp.completed_at, lp.updated_at, lp.last_seen_at))
            from lesson_progress lp
            join course_lessons cl on cl.lesson_id = lp.lesson_id
            where lp.membership_id = r.membership_id
              and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
          ) as last_activity_at,
          (
            select cl.title
            from lesson_progress lp
            join course_lessons cl on cl.lesson_id = lp.lesson_id
            where lp.membership_id = r.membership_id
              and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
              and lp.status = 'completed'
            order by coalesce(lp.completed_at, lp.updated_at) desc nulls last
            limit 1
          ) as last_lesson_title,
          (
            select cl.sequence_number
            from lesson_progress lp
            join course_lessons cl on cl.lesson_id = lp.lesson_id
            where lp.membership_id = r.membership_id
              and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
              and lp.status = 'completed'
            order by coalesce(lp.completed_at, lp.updated_at) desc nulls last
            limit 1
          ) as last_lesson_sequence,
          (
            select min(coalesce(lp.completed_at, lp.updated_at))
            from lesson_progress lp
            join course_lessons cl on cl.lesson_id = lp.lesson_id
            where lp.membership_id = r.membership_id
              and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
              and lp.status = 'completed'
          ) as first_completed_at
        from roster r
      ),
      labeled as (
        select
          *,
          case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0
          end as completion_pct,
          case
            when last_activity_at is null then null
            else greatest(0, floor(extract(epoch from (now() - last_activity_at)) / 86400.0))::int
          end as days_since_activity,
          case
            when total_lessons > 0 and completed_lessons >= total_lessons then 'finished'
            when completed_lessons = 0 then 'never_started'
            when last_activity_at is null
              or last_activity_at < now() - make_interval(days => ${stalledDays})
              then 'stalled'
            else 'in_progress'
          end as activity_status,
          case
            when completed_lessons > 0 and first_completed_at is not null and last_activity_at is not null
              and extract(epoch from (last_activity_at - first_completed_at)) > 0
              then completed_lessons::float
                / greatest(1.0, extract(epoch from (last_activity_at - first_completed_at)) / 86400.0)
            else null
          end as lessons_per_day
        from scored
      )
      select *
      from labeled
      where ${query.view}::text = 'any' or activity_status = ${query.view}::text
      order by
        case when ${query.sortBy}::text = 'learner_name' and ${sortDir}::text = 'asc'
          then lower(coalesce(learner_name, '')) end asc nulls last,
        case when ${query.sortBy}::text = 'learner_name' and ${sortDir}::text = 'desc'
          then lower(coalesce(learner_name, '')) end desc nulls last,
        case when ${query.sortBy}::text = 'completion_pct' and ${sortDir}::text = 'asc'
          then completion_pct end asc nulls last,
        case when ${query.sortBy}::text = 'completion_pct' and ${sortDir}::text = 'desc'
          then completion_pct end desc nulls last,
        case when ${query.sortBy}::text = 'days_since' and ${sortDir}::text = 'asc'
          then days_since_activity end asc nulls last,
        case when ${query.sortBy}::text = 'days_since' and ${sortDir}::text = 'desc'
          then days_since_activity end desc nulls last,
        case when ${query.sortBy}::text = 'last_activity' and ${sortDir}::text = 'asc'
          then last_activity_at end asc nulls last,
        case when ${query.sortBy}::text = 'last_activity' and ${sortDir}::text = 'desc'
          then last_activity_at end desc nulls last,
        case when ${query.sortBy}::text = 'projected_finish' and ${sortDir}::text = 'asc'
          then lessons_per_day end asc nulls last,
        case when ${query.sortBy}::text = 'projected_finish' and ${sortDir}::text = 'desc'
          then lessons_per_day end desc nulls last,
        lower(coalesce(learner_name, '')) asc
      limit ${query.limit} offset ${offset}
    `;

    return {
      totalCount,
      items: rows.map((row) => ({
        membership_id: asUnknownString(row["membership_id"]),
        learner_name: row["learner_name"] == null ? null : asUnknownString(row["learner_name"]),
        email: row["email"] == null ? null : asUnknownString(row["email"]),
        completion_pct: Number(row["completion_pct"] ?? 0),
        completed_lessons: Number(row["completed_lessons"] ?? 0),
        total_lessons: Number(row["total_lessons"] ?? 0),
        last_lesson_title:
          row["last_lesson_title"] == null ? null : asUnknownString(row["last_lesson_title"]),
        last_lesson_sequence:
          row["last_lesson_sequence"] == null ? null : Number(row["last_lesson_sequence"]),
        last_activity_at:
          row["last_activity_at"] == null ? null : (row["last_activity_at"] as Date),
        days_since_activity:
          row["days_since_activity"] == null ? null : Number(row["days_since_activity"]),
        lessons_per_day: row["lessons_per_day"] == null ? null : Number(row["lessons_per_day"]),
        joined_at: row["joined_at"] == null ? null : (row["joined_at"] as Date),
      })),
    };
  },

  async listBatchContentStalledMembershipIds(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    stalledDays = 14,
  ): Promise<string[]> {
    if (!courseId) return [];

    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      with roster as (
        select bm.membership_id
        from batch_memberships bm
        where bm.batch_id = ${batchId}::uuid
      ),
      course_lessons as (
        select l.id as lesson_id
        from lessons l
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where cm.course_id = ${courseId}::uuid and l.deleted_at is null
      ),
      totals as (select count(*)::int as total_lessons from course_lessons),
      scored as (
        select
          r.membership_id,
          (select total_lessons from totals) as total_lessons,
          (
            select count(*)::int
            from lesson_progress lp
            join course_lessons cl on cl.lesson_id = lp.lesson_id
            where lp.membership_id = r.membership_id
              and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
              and lp.status = 'completed'
          ) as completed_lessons,
          (
            select max(coalesce(lp.completed_at, lp.updated_at, lp.last_seen_at))
            from lesson_progress lp
            join course_lessons cl on cl.lesson_id = lp.lesson_id
            where lp.membership_id = r.membership_id
              and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
          ) as last_activity_at
        from roster r
      )
      select membership_id::text as membership_id
      from scored
      where completed_lessons > 0
        and (total_lessons = 0 or completed_lessons < total_lessons)
        and (
          last_activity_at is null
          or last_activity_at < now() - make_interval(days => ${stalledDays})
        )
      order by last_activity_at asc nulls first
    `;
    return rows.map((row) => row.membership_id);
  },

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
