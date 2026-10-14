import type { TenantTx } from "@atlas/db";
import type { BatchLearnersQuery } from "./batches-roster.dto";
import type {
  ActivityDayRow,
  BatchLearnerRow,
  BatchLearnersFilter,
  CourseProgressDetailRow,
  ExamDetailRow,
  LessonStripRow,
  LiveAttendanceDetailRow,
} from "./batches-roster.repository";
import { asUnknownString } from "./batches-roster.repository-helpers";

/**
 * A batch's learner roster, one learner's detail, and removing a learner.
 * Part of batchesRosterRepository.
 */
export const batchesRosterLearnersRepository = {
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
};
