import type { TenantTx } from "@atlas/db";

/**
 * The signals on the progress and score overview.
 * Part of progressScoreRosterRepository.
 */
export const progressScoreRosterOverviewRepository = {
  async getOverviewSignals(
    tx: TenantTx,
    args: { windowFrom: Date; windowTo: Date; previousFrom: Date; previousTo: Date },
  ): Promise<{
    averageCompletionPct: number | null;
    previousAverageCompletionPct: number | null;
    activeEnrolmentCount: number;
    learnersAtRiskCount: number;
    assessmentPassRatePct: number | null;
    assessmentAttemptCount: number;
    awaitingGradingCount: number;
    enrolmentActivityCount: number;
    completionBands: {
      not_started: number;
      early: number;
      in_progress: number;
      nearly_done: number;
      complete: number;
    };
  }> {
    const [completionRows, previousCompletionRows, activityRows, scoreRows, gradingRows, bandRows] =
      await Promise.all([
        tx.$queryRaw<Array<{ avg_completion_pct: number | null; active_count: number }>>`
          with course_totals as (
            select
              m.course_id,
              count(l.id)::int as total_lessons
            from course_modules m
            join lessons l
              on l.module_id = m.id
              and l.tenant_id = m.tenant_id
              and l.deleted_at is null
            where m.tenant_id = current_setting('app.tenant_id', true)::uuid
              and m.deleted_at is null
            group by m.course_id
          ),
          enrolments as (
            select
              e.id,
              e.membership_id,
              e.course_id,
              coalesce(ct.total_lessons, 0) as total_lessons,
              (
                select count(*)::int
                from lesson_progress lp
                join lessons cl on cl.id = lp.lesson_id and cl.tenant_id = lp.tenant_id
                join course_modules cm on cm.id = cl.module_id and cm.tenant_id = cl.tenant_id
                where lp.membership_id = e.membership_id
                  and lp.tenant_id = e.tenant_id
                  and cm.course_id = e.course_id
                  and lp.status = 'completed'
                  and cl.deleted_at is null
                  and cm.deleted_at is null
              ) as completed_lessons
            from enrollments e
            left join course_totals ct on ct.course_id = e.course_id
            where e.tenant_id = current_setting('app.tenant_id', true)::uuid
              and e.status = 'active'
              and (e.expires_at is null or e.expires_at > now())
              and e.enrolled_at <= ${args.windowTo}
          )
          select
            avg(
              case when total_lessons > 0
                then (completed_lessons::numeric / total_lessons::numeric) * 100
                else null
              end
            )::float as avg_completion_pct,
            count(*)::int as active_count
          from enrolments
        `,
        tx.$queryRaw<Array<{ avg_completion_pct: number | null }>>`
          with course_totals as (
            select
              m.course_id,
              count(l.id)::int as total_lessons
            from course_modules m
            join lessons l
              on l.module_id = m.id
              and l.tenant_id = m.tenant_id
              and l.deleted_at is null
            where m.tenant_id = current_setting('app.tenant_id', true)::uuid
              and m.deleted_at is null
            group by m.course_id
          ),
          enrolments as (
            select
              e.id,
              e.membership_id,
              e.course_id,
              coalesce(ct.total_lessons, 0) as total_lessons,
              (
                select count(*)::int
                from lesson_progress lp
                join lessons cl on cl.id = lp.lesson_id and cl.tenant_id = lp.tenant_id
                join course_modules cm on cm.id = cl.module_id and cm.tenant_id = cl.tenant_id
                where lp.membership_id = e.membership_id
                  and lp.tenant_id = e.tenant_id
                  and cm.course_id = e.course_id
                  and lp.status = 'completed'
                  and cl.deleted_at is null
                  and cm.deleted_at is null
              ) as completed_lessons
            from enrollments e
            left join course_totals ct on ct.course_id = e.course_id
            where e.tenant_id = current_setting('app.tenant_id', true)::uuid
              and e.status = 'active'
              and (e.expires_at is null or e.expires_at > ${args.previousTo})
              and e.enrolled_at <= ${args.previousTo}
          )
          select
            avg(
              case when total_lessons > 0
                then (completed_lessons::numeric / total_lessons::numeric) * 100
                else null
              end
            )::float as avg_completion_pct
          from enrolments
        `,
        tx.$queryRaw<Array<{ at_risk_count: number; activity_count: number }>>`
          with active as (
            select e.id, e.membership_id, e.course_id, e.enrolled_at
            from enrollments e
            where e.tenant_id = current_setting('app.tenant_id', true)::uuid
              and e.status = 'active'
              and (e.expires_at is null or e.expires_at > now())
          ),
          last_seen as (
            select
              a.id as enrollment_id,
              greatest(
                a.enrolled_at,
                coalesce(
                  (
                    select max(coalesce(lp.last_seen_at, lp.updated_at))
                    from lesson_progress lp
                    join lessons cl on cl.id = lp.lesson_id and cl.tenant_id = lp.tenant_id
                    join course_modules cm on cm.id = cl.module_id and cm.tenant_id = cl.tenant_id
                    where lp.membership_id = a.membership_id
                      and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
                      and cm.course_id = a.course_id
                      and cl.deleted_at is null
                      and cm.deleted_at is null
                  ),
                  a.enrolled_at
                )
              ) as last_activity_at
            from active a
          )
          select
            (
              select count(*)::int
              from last_seen
              where last_activity_at < now() - interval '14 days'
            ) as at_risk_count,
            (
              select count(*)::int
              from enrollments e
              where e.tenant_id = current_setting('app.tenant_id', true)::uuid
                and e.enrolled_at >= ${args.windowFrom}
                and e.enrolled_at <= ${args.windowTo}
            ) as activity_count
        `,
        tx.$queryRaw<
          Array<{
            attempt_count: number;
            pass_count: number;
            scored_count: number;
          }>
        >`
          with latest as (
            select distinct on (at.assessment_id, at.membership_id)
              at.id,
              at.score_pct,
              nullif(a.config_json->>'passMarkPercent', '')::float as pass_mark
            from attempts at
            join assessments a on a.id = at.assessment_id and a.tenant_id = at.tenant_id
            where at.tenant_id = current_setting('app.tenant_id', true)::uuid
              and at.status in ('SUBMITTED', 'GRADED')
              and coalesce(at.submitted_at, at.graded_at, at.started_at) >= ${args.windowFrom}
              and coalesce(at.submitted_at, at.graded_at, at.started_at) <= ${args.windowTo}
              and a.deleted_at is null
            order by at.assessment_id, at.membership_id, coalesce(at.submitted_at, at.graded_at, at.started_at) desc
          )
          select
            count(*)::int as attempt_count,
            count(*) filter (
              where score_pct is not null
                and pass_mark is not null
                and score_pct >= pass_mark
            )::int as pass_count,
            count(*) filter (
              where score_pct is not null and pass_mark is not null
            )::int as scored_count
          from latest
        `,
        tx.$queryRaw<Array<{ awaiting_count: number }>>`
          select count(*)::int as awaiting_count
          from attempts at
          where at.tenant_id = current_setting('app.tenant_id', true)::uuid
            and at.status = 'SUBMITTED'
            and at.graded_at is null
        `,
        tx.$queryRaw<
          Array<{
            not_started: number;
            early: number;
            in_progress: number;
            nearly_done: number;
            complete: number;
          }>
        >`
          with course_totals as (
            select
              m.course_id,
              count(l.id)::int as total_lessons
            from course_modules m
            join lessons l
              on l.module_id = m.id
              and l.tenant_id = m.tenant_id
              and l.deleted_at is null
            where m.tenant_id = current_setting('app.tenant_id', true)::uuid
              and m.deleted_at is null
            group by m.course_id
          ),
          enrolments as (
            select
              case
                when coalesce(ct.total_lessons, 0) = 0 then 0
                else round((
                  (
                    select count(*)::numeric
                    from lesson_progress lp
                    join lessons cl on cl.id = lp.lesson_id and cl.tenant_id = lp.tenant_id
                    join course_modules cm on cm.id = cl.module_id and cm.tenant_id = cl.tenant_id
                    where lp.membership_id = e.membership_id
                      and lp.tenant_id = e.tenant_id
                      and cm.course_id = e.course_id
                      and lp.status = 'completed'
                      and cl.deleted_at is null
                      and cm.deleted_at is null
                  ) / ct.total_lessons::numeric
                ) * 100)::int
              end as completion_pct
            from enrollments e
            left join course_totals ct on ct.course_id = e.course_id
            where e.tenant_id = current_setting('app.tenant_id', true)::uuid
              and e.status = 'active'
              and (e.expires_at is null or e.expires_at > now())
          )
          select
            count(*) filter (where completion_pct = 0)::int as not_started,
            count(*) filter (where completion_pct > 0 and completion_pct < 25)::int as early,
            count(*) filter (where completion_pct >= 25 and completion_pct < 75)::int as in_progress,
            count(*) filter (where completion_pct >= 75 and completion_pct < 100)::int as nearly_done,
            count(*) filter (where completion_pct = 100)::int as complete
          from enrolments
        `,
      ]);

    const completion = completionRows[0];
    const previous = previousCompletionRows[0];
    const activity = activityRows[0];
    const scores = scoreRows[0];
    const grading = gradingRows[0];
    const bands = bandRows[0];

    const scoredCount = scores?.scored_count ?? 0;
    const passCount = scores?.pass_count ?? 0;

    return {
      averageCompletionPct:
        completion?.avg_completion_pct == null
          ? null
          : Math.round(completion.avg_completion_pct * 10) / 10,
      previousAverageCompletionPct:
        previous?.avg_completion_pct == null
          ? null
          : Math.round(previous.avg_completion_pct * 10) / 10,
      activeEnrolmentCount: completion?.active_count ?? 0,
      learnersAtRiskCount: activity?.at_risk_count ?? 0,
      assessmentPassRatePct:
        scoredCount > 0 ? Math.round((passCount / scoredCount) * 1000) / 10 : null,
      assessmentAttemptCount: scores?.attempt_count ?? 0,
      awaitingGradingCount: grading?.awaiting_count ?? 0,
      enrolmentActivityCount: activity?.activity_count ?? 0,
      completionBands: {
        not_started: bands?.not_started ?? 0,
        early: bands?.early ?? 0,
        in_progress: bands?.in_progress ?? 0,
        nearly_done: bands?.nearly_done ?? 0,
        complete: bands?.complete ?? 0,
      },
    };
  },
};
