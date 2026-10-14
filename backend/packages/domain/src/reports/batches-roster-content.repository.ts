import type { TenantTx } from "@atlas/db";
import { asUnknownString } from "./batches-roster.repository-helpers";

/**
 * A batch's content progress: summary, funnel, pace and stalled learners.
 * Part of batchesRosterRepository.
 */
export const batchesRosterContentRepository = {
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
};
