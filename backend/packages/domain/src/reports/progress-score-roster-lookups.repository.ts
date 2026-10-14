import type { TenantTx } from "@atlas/db";
import type { ProgressProductType, ScoreProductType } from "./progress-score-roster.dto";
import type {
  ProgressCurriculumLessonRow,
  ProgressLearnerRosterProductRow,
  ProgressLearnerRosterSummaryRow,
  ScoreAssessmentDetailMeta,
  ScoreLearnerSummaryRow,
} from "./progress-score-roster.repository";

/**
 * Titles, roster headers and summaries shown above the progress and score tables.
 * Part of progressScoreRosterRepository.
 */
export const progressScoreRosterLookupsRepository = {
  async findCourseTitle(tx: TenantTx, courseId: string): Promise<string | null> {
    return this.findProductTitle(tx, "course", courseId);
  },

  async findProductTitle(
    tx: TenantTx,
    productType: ProgressProductType | ScoreProductType,
    productId: string,
  ): Promise<string | null> {
    if (productType === "course") {
      const rows = await tx.$queryRaw<Array<{ title: string }>>`
        select title
        from courses
        where id = ${productId}::uuid
          and deleted_at is null
        limit 1
      `;
      return rows[0]?.title ?? null;
    }
    if (productType === "test_series") {
      const rows = await tx.$queryRaw<Array<{ title: string }>>`
        select title
        from test_series
        where id = ${productId}::uuid
          and deleted_at is null
        limit 1
      `;
      return rows[0]?.title ?? null;
    }
    if (productType === "bundle") {
      const rows = await tx.$queryRaw<Array<{ title: string }>>`
        select title
        from bundles
        where id = ${productId}::uuid
          and deleted_at is null
        limit 1
      `;
      return rows[0]?.title ?? null;
    }
    if (productType === "subscription") {
      const rows = await tx.$queryRaw<Array<{ title: string }>>`
        select title
        from learner_subscription_plans
        where id = ${productId}::uuid
          and deleted_at is null
        limit 1
      `;
      return rows[0]?.title ?? null;
    }
    const rows = await tx.$queryRaw<Array<{ title: string }>>`
      select title
      from mock_tests
      where id = ${productId}::uuid
        and deleted_at is null
      limit 1
    `;
    return rows[0]?.title ?? null;
  },

  async getLearnerRosterProduct(
    tx: TenantTx,
    productType: ProgressProductType,
    productId: string,
  ): Promise<ProgressLearnerRosterProductRow | null> {
    if (productType === "course") {
      const rows = await tx.$queryRaw<ProgressLearnerRosterProductRow[]>`
        select
          c.id::text as id,
          c.title,
          c.slug,
          c.status::text as status,
          coalesce(lessons.lesson_count, 0)::int as lesson_count,
          coalesce(qz.assessment_count, 0)::int as assessment_count,
          coalesce(enr.enrolled_count, 0)::int as enrolled_count
        from courses c
        left join lateral (
          select count(l.id)::int as lesson_count
          from course_modules m
          join lessons l on l.module_id = m.id and l.tenant_id = m.tenant_id and l.deleted_at is null
          where m.course_id = c.id and m.tenant_id = c.tenant_id and m.deleted_at is null
        ) lessons on true
        left join lateral (
          select count(distinct coalesce(
            l.content_json->'content'->>'assessmentId',
            l.content_json->>'assessmentId'
          ))::int as assessment_count
          from course_modules cm
          join lessons l on l.module_id = cm.id and l.tenant_id = cm.tenant_id and l.deleted_at is null
          where cm.course_id = c.id
            and cm.tenant_id = c.tenant_id
            and cm.deleted_at is null
            and coalesce(
              l.content_json->'content'->>'assessmentId',
              l.content_json->>'assessmentId'
            ) ~ '^[0-9a-fA-F-]{36}$'
        ) qz on true
        left join lateral (
          select count(*)::int as enrolled_count
          from enrollments e
          where e.course_id = c.id and e.tenant_id = c.tenant_id
        ) enr on true
        where c.id = ${productId}::uuid
          and c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
        limit 1
      `;
      return rows[0] ?? null;
    }

    if (productType === "test_series") {
      const rows = await tx.$queryRaw<ProgressLearnerRosterProductRow[]>`
        select
          ts.id::text as id,
          ts.title,
          ts.slug,
          ts.status::text as status,
          coalesce(items.item_count, 0)::int as lesson_count,
          coalesce(items.item_count, 0)::int as assessment_count,
          coalesce(enr.enrolled_count, 0)::int as enrolled_count
        from test_series ts
        left join lateral (
          select count(*)::int as item_count
          from test_series_items tsi
          where tsi.test_series_id = ts.id and tsi.tenant_id = ts.tenant_id
        ) items on true
        left join lateral (
          select count(*)::int as enrolled_count
          from test_series_enrollments tse
          where tse.test_series_id = ts.id and tse.tenant_id = ts.tenant_id
        ) enr on true
        where ts.id = ${productId}::uuid
          and ts.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ts.deleted_at is null
        limit 1
      `;
      return rows[0] ?? null;
    }

    if (productType === "bundle") {
      const rows = await tx.$queryRaw<ProgressLearnerRosterProductRow[]>`
        select
          b.id::text as id,
          b.title,
          b.slug,
          b.status::text as status,
          coalesce(items.item_count, 0)::int as lesson_count,
          0::int as assessment_count,
          coalesce(enr.enrolled_count, 0)::int as enrolled_count
        from bundles b
        left join lateral (
          select count(*)::int as item_count
          from bundle_items bi
          where bi.bundle_id = b.id and bi.tenant_id = b.tenant_id
        ) items on true
        left join lateral (
          select count(*)::int as enrolled_count
          from bundle_enrollments be
          where be.bundle_id = b.id and be.tenant_id = b.tenant_id
        ) enr on true
        where b.id = ${productId}::uuid
          and b.tenant_id = current_setting('app.tenant_id', true)::uuid
          and b.deleted_at is null
        limit 1
      `;
      return rows[0] ?? null;
    }

    const rows = await tx.$queryRaw<ProgressLearnerRosterProductRow[]>`
      select
        p.id::text as id,
        p.title,
        p.slug,
        p.status::text as status,
        coalesce(items.item_count, 0)::int as lesson_count,
        0::int as assessment_count,
        coalesce(enr.enrolled_count, 0)::int as enrolled_count
      from learner_subscription_plans p
      left join lateral (
        select count(*)::int as item_count
        from learner_subscription_plan_items lspi
        where lspi.plan_id = p.id and lspi.tenant_id = p.tenant_id
      ) items on true
      left join lateral (
        select count(*)::int as enrolled_count
        from learner_subscription_enrollments lse
        where lse.plan_id = p.id and lse.tenant_id = p.tenant_id
      ) enr on true
      where p.id = ${productId}::uuid
        and p.tenant_id = current_setting('app.tenant_id', true)::uuid
        and p.deleted_at is null
      limit 1
    `;
    return rows[0] ?? null;
  },

  async getLearnerRosterSummary(
    tx: TenantTx,
    productType: ProgressProductType,
    productId: string,
  ): Promise<ProgressLearnerRosterSummaryRow> {
    if (productType !== "course") {
      return {
        avg_completion_pct: null,
        completed_count: 0,
        stalled_count: 0,
        not_started_count: 0,
        expiring_within_30d_count: 0,
      };
    }

    const rows = await tx.$queryRaw<ProgressLearnerRosterSummaryRow[]>`
      with course_lessons as (
        select l.id
        from lessons l
        inner join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
        where m.course_id = ${productId}::uuid
          and l.deleted_at is null
          and m.deleted_at is null
      ),
      enrolments as (
        select
          e.id,
          e.expires_at,
          case
            when (select count(*)::int from course_lessons) = 0 then 0
            else round((
              (
                select count(*)::numeric
                from lesson_progress lp
                inner join course_lessons cl on cl.id = lp.lesson_id
                where lp.membership_id = e.membership_id
                  and lp.tenant_id = e.tenant_id
                  and lp.status = 'completed'
              ) / (select count(*)::numeric from course_lessons)
            ) * 100)::int
          end as completion_pct,
          greatest(
            e.enrolled_at,
            coalesce(
              (
                select max(coalesce(lp.last_seen_at, lp.updated_at))
                from lesson_progress lp
                inner join course_lessons cl on cl.id = lp.lesson_id
                where lp.membership_id = e.membership_id
                  and lp.tenant_id = e.tenant_id
              ),
              e.enrolled_at
            )
          ) as last_activity_at
        from enrollments e
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.course_id = ${productId}::uuid
          and e.status = 'active'
          and (e.expires_at is null or e.expires_at > now())
      )
      select
        avg(completion_pct::numeric)::float as avg_completion_pct,
        count(*) filter (where completion_pct = 100)::int as completed_count,
        count(*) filter (
          where completion_pct > 0 and last_activity_at < now() - interval '14 days'
        )::int as stalled_count,
        count(*) filter (where completion_pct = 0)::int as not_started_count,
        (
          select count(*)::int
          from enrollments e2
          where e2.tenant_id = current_setting('app.tenant_id', true)::uuid
            and e2.course_id = ${productId}::uuid
            and e2.expires_at is not null
            and e2.expires_at > now()
            and e2.expires_at <= now() + interval '30 days'
        ) as expiring_within_30d_count
      from enrolments
    `;

    const row = rows[0];
    return {
      avg_completion_pct: row?.avg_completion_pct == null ? null : row.avg_completion_pct,
      completed_count: row?.completed_count ?? 0,
      stalled_count: row?.stalled_count ?? 0,
      not_started_count: row?.not_started_count ?? 0,
      expiring_within_30d_count: row?.expiring_within_30d_count ?? 0,
    };
  },

  async getCourseCurriculumStrip(
    tx: TenantTx,
    courseId: string,
  ): Promise<ProgressCurriculumLessonRow[]> {
    return tx.$queryRaw<ProgressCurriculumLessonRow[]>`
      with ordered_lessons as (
        select
          l.id,
          l.title,
          row_number() over (order by m.position asc, l.position asc) - 1 as position
        from course_modules m
        join lessons l on l.module_id = m.id and l.tenant_id = m.tenant_id and l.deleted_at is null
        where m.course_id = ${courseId}::uuid
          and m.tenant_id = current_setting('app.tenant_id', true)::uuid
          and m.deleted_at is null
      ),
      active_enrolments as (
        select e.membership_id
        from enrollments e
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.course_id = ${courseId}::uuid
          and e.status = 'active'
          and (e.expires_at is null or e.expires_at > now())
      ),
      enrolment_total as (
        select count(*)::int as total from active_enrolments
      )
      select
        ol.id::text as lesson_id,
        ol.title,
        ol.position::int as position,
        case
          when (select total from enrolment_total) = 0 then 0
          else round((
            (
              select count(*)::numeric
              from lesson_progress lp
              join active_enrolments ae on ae.membership_id = lp.membership_id
              where lp.lesson_id = ol.id
                and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
                and lp.status = 'completed'
            ) / (select total from enrolment_total)::numeric
          ) * 100)::int
        end as completion_pct,
        (
          select count(*)::int
          from lesson_progress lp
          join active_enrolments ae on ae.membership_id = lp.membership_id
          where lp.lesson_id = ol.id
            and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
            and lp.status = 'completed'
        ) as completed_count
      from ordered_lessons ol
      order by ol.position asc
    `;
  },

  async findAssessmentMeta(
    tx: TenantTx,
    assessmentId: string,
  ): Promise<ScoreAssessmentDetailMeta | null> {
    const rows = await tx.$queryRaw<ScoreAssessmentDetailMeta[]>`
      select
        a.title,
        a.assessment_type,
        nullif(a.config_json->>'passMarkPercent', '')::float as pass_mark_percent,
        (
          select count(*)::int
          from assessment_items ai
          where ai.assessment_id = a.id
            and ai.tenant_id = a.tenant_id
        ) as question_count,
        lesson_link.lesson_id::text as lesson_id,
        lesson_link.lesson_title,
        cm.course_id::text as course_id,
        c.title as course_title,
        case
          when cm.course_id is not null then 'course'
          when mt.id is not null then 'mock_test'
          else null
        end as product_type,
        coalesce(cm.course_id, mt.id)::text as product_id,
        coalesce(c.title, mt.title) as product_title
      from assessments a
      left join lateral (
        select
          l.id as lesson_id,
          l.title as lesson_title,
          l.module_id
        from lessons l
        where l.tenant_id = a.tenant_id
          and l.deleted_at is null
          and (
            coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId')
          ) = a.id::text
        order by l.position asc
        limit 1
      ) lesson_link on true
      left join course_modules cm on cm.id = lesson_link.module_id and cm.tenant_id = a.tenant_id and cm.deleted_at is null
      left join courses c on c.id = cm.course_id and c.tenant_id = a.tenant_id and c.deleted_at is null
      left join mock_tests mt on mt.assessment_id = a.id and mt.tenant_id = a.tenant_id and mt.deleted_at is null
      where a.id = ${assessmentId}::uuid
        and a.deleted_at is null
      limit 1
    `;
    return rows[0] ?? null;
  },

  async getScoreLearnerSummary(
    tx: TenantTx,
    assessmentId: string,
  ): Promise<ScoreLearnerSummaryRow> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with pass_mark as (
        select nullif(a.config_json->>'passMarkPercent', '')::float as pass_mark
        from assessments a
        where a.id = ${assessmentId}::uuid
      ),
      latest as (
        select distinct on (at.membership_id)
          at.membership_id,
          at.score_pct,
          at.status::text as attempt_status,
          case
            when at.submitted_at is not null
              then extract(epoch from (at.submitted_at - at.started_at))
            else null
          end as duration_sec
        from attempts at
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.assessment_id = ${assessmentId}::uuid
          and at.status::text <> 'VOIDED'
        order by at.membership_id, coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      )
      select
        (select count(*)::int from latest) as learner_count,
        (
          select count(*)::int
          from latest lt
          cross join pass_mark pm
          where lt.score_pct is not null
            and pm.pass_mark is not null
            and lt.score_pct >= pm.pass_mark
        ) as passed_count,
        (
          select count(*)::int
          from attempts at
          where at.tenant_id = current_setting('app.tenant_id', true)::uuid
            and at.assessment_id = ${assessmentId}::uuid
            and at.status::text <> 'VOIDED'
        ) as attempt_count,
        (select avg(score_pct)::float from latest where score_pct is not null) as avg_score_pct,
        (
          select
            case
              when count(*) filter (where lt.score_pct is not null and pm.pass_mark is not null) = 0 then null
              else (
                count(*) filter (
                  where lt.score_pct is not null and pm.pass_mark is not null and lt.score_pct >= pm.pass_mark
                )::numeric
                / count(*) filter (where lt.score_pct is not null and pm.pass_mark is not null)::numeric
              ) * 100
            end
          from latest lt
          cross join pass_mark pm
        )::float as pass_rate_pct,
        (
          select count(*)::int
          from attempts at
          where at.tenant_id = current_setting('app.tenant_id', true)::uuid
            and at.assessment_id = ${assessmentId}::uuid
            and at.status::text = 'SUBMITTED'
            and at.score_pct is null
        ) as ungraded_count,
        (
          select percentile_cont(0.5) within group (order by duration_sec)::float
          from latest
          where duration_sec is not null and duration_sec >= 0
        ) as median_duration_seconds
    `;
    const row = rows[0] ?? {};
    return {
      learner_count: Number(row["learner_count"] ?? 0),
      passed_count: Number(row["passed_count"] ?? 0),
      attempt_count: Number(row["attempt_count"] ?? 0),
      avg_score_pct: row["avg_score_pct"] == null ? null : Number(row["avg_score_pct"]),
      pass_rate_pct: row["pass_rate_pct"] == null ? null : Number(row["pass_rate_pct"]),
      ungraded_count: Number(row["ungraded_count"] ?? 0),
      median_duration_seconds:
        row["median_duration_seconds"] == null ? null : Number(row["median_duration_seconds"]),
    };
  },
};
