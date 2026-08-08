import type { TenantTx } from "@atlas/db";
import type {
  ProgressCoursesQuery,
  ProgressLearnersQuery,
  ProgressProductsQuery,
  ProgressProductType,
  ProductPublishStatus,
  ScoreLearnersQuery,
  ScoreProductType,
  ScoreQuizzesQuery,
} from "./progress-score-roster.dto";

export type { ProgressProductType, ScoreProductType };

export type ProgressCourseRow = {
  id: string;
  title: string;
  slug: string;
  enrolled_count: number;
  quiz_count: number;
};

export type ProgressProductRow = {
  id: string;
  title: string;
  slug: string;
  status: ProductPublishStatus;
  enrolled_count: number;
  quiz_count: number;
  assessment_id: string | null;
  avg_completion_pct: number | null;
  band_not_started: number;
  band_early: number;
  band_in_progress: number;
  band_nearly_done: number;
  band_complete: number;
  not_started_count: number;
  last_activity_at: Date | null;
};

type ProductListQuery = ProgressCoursesQuery | ProgressProductsQuery;

function productListFilters(query: ProductListQuery): {
  q?: string;
  status?: ProductPublishStatus;
  sortBy: ProgressProductsQuery["sortBy"];
  sortDir: ProgressProductsQuery["sortDir"];
  limit: number;
  page: number;
} {
  return {
    ...(query.q ? { q: query.q } : {}),
    ...("status" in query && query.status ? { status: query.status } : {}),
    sortBy: "sortBy" in query && query.sortBy ? query.sortBy : "title",
    sortDir: "sortDir" in query && query.sortDir ? query.sortDir : "asc",
    limit: query.limit,
    page: query.page,
  };
}


export type ProgressLearnerRow = {
  enrollment_id: string;
  membership_id: string;
  course_id: string;
  learner_name: string | null;
  email: string | null;
  completion_pct: number;
  completed_lessons: number;
  total_lessons: number;
  enrolled_type: string;
  status: string;
  activity_status: "active" | "stalled" | "not_started";
  last_lesson_title: string | null;
  last_activity_at: Date | null;
  enrolled_at: Date;
  expires_at: Date | null;
};

export type ProgressLearnerRosterProductRow = {
  id: string;
  title: string;
  slug: string;
  status: ProductPublishStatus;
  lesson_count: number;
  assessment_count: number;
  enrolled_count: number;
};

export type ProgressLearnerRosterSummaryRow = {
  avg_completion_pct: number | null;
  completed_count: number;
  stalled_count: number;
  not_started_count: number;
  expiring_within_30d_count: number;
};

export type ProgressCurriculumLessonRow = {
  lesson_id: string;
  title: string;
  position: number;
  completion_pct: number;
  completed_count: number;
};

export type ScoreQuizRow = {
  assessment_id: string;
  title: string;
  assessment_type: string;
  lesson_id: string | null;
  lesson_title: string | null;
  attempt_count: number;
  learner_count: number;
};

export type ScoreLearnerRow = {
  membership_id: string;
  assessment_id: string;
  learner_name: string | null;
  email: string | null;
  result_status: "pass" | "fail" | "pending" | "in_progress";
  attempt_count: number;
  score_pct: number | null;
  best_score_pct: number | null;
  answered_count: number;
  question_count: number | null;
  duration_seconds: number | null;
  submitted_at: Date | null;
  started_at: Date | null;
  latest_attempt_id: string | null;
  improved_on_retry: boolean;
};

export type ProgressLearnersFilter = {
  productType: ProgressProductType;
  productId: string;
  enrolledFrom?: string;
  enrolledTo?: string;
  learnerName?: string;
  enrolledType?: string;
  status?: string;
  view?: ProgressLearnersQuery["view"];
  completionBand?: ProgressLearnersQuery["completionBand"];
  activityStatus?: ProgressLearnersQuery["activityStatus"];
};

export type ScoreLearnersFilter = {
  assessmentId: string;
  submittedFrom?: string;
  submittedTo?: string;
  learnerName?: string;
  resultStatus?: string;
  minScore?: number;
  maxScore?: number;
  minAttempts?: number;
  attemptsFilter?: ScoreLearnersQuery["attemptsFilter"];
  view?: ScoreLearnersQuery["view"];
};

export type ScoreAssessmentDetailMeta = {
  title: string;
  assessment_type: string;
  pass_mark_percent: number | null;
  question_count: number;
  lesson_id: string | null;
  lesson_title: string | null;
  course_id: string | null;
  course_title: string | null;
  product_type: ScoreProductType | null;
  product_id: string | null;
  product_title: string | null;
};

export type ScoreLearnerSummaryRow = {
  learner_count: number;
  passed_count: number;
  attempt_count: number;
  avg_score_pct: number | null;
  pass_rate_pct: number | null;
  ungraded_count: number;
  median_duration_seconds: number | null;
};

function mapProgressLearnerRows(rows: Array<Record<string, unknown>>): ProgressLearnerRow[] {
  return rows.map((row) => ({
    enrollment_id: String(row["enrollment_id"]),
    membership_id: String(row["membership_id"]),
    course_id: String(row["course_id"]),
    learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
    email: typeof row["email"] === "string" ? row["email"] : null,
    completion_pct: Number(row["completion_pct"] ?? 0),
    completed_lessons: Number(row["completed_lessons"] ?? 0),
    total_lessons: Number(row["total_lessons"] ?? 0),
    enrolled_type: String(row["enrolled_type"] ?? "free"),
    status: String(row["status"]),
    activity_status: (["active", "stalled", "not_started"].includes(
      String(row["activity_status"] ?? ""),
    )
      ? String(row["activity_status"])
      : Number(row["completion_pct"] ?? 0) === 0
        ? "not_started"
        : "active") as ProgressLearnerRow["activity_status"],
    last_lesson_title:
      typeof row["last_lesson_title"] === "string" ? row["last_lesson_title"] : null,
    last_activity_at: row["last_activity_at"] instanceof Date ? row["last_activity_at"] : null,
    enrolled_at: row["enrolled_at"] as Date,
    expires_at: row["expires_at"] instanceof Date ? row["expires_at"] : null,
  }));
}

export const progressScoreRosterRepository = {
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
    if (productType === "mock_test") {
      const rows = await tx.$queryRaw<Array<{ title: string }>>`
        select title
        from mock_tests
        where id = ${productId}::uuid
          and deleted_at is null
        limit 1
      `;
      return rows[0]?.title ?? null;
    }
    return null;
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

    if (productType === "subscription") {
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
    }

    return null;
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
      avg_completion_pct:
        row?.avg_completion_pct == null ? null : Number(row.avg_completion_pct),
      completed_count: Number(row?.completed_count ?? 0),
      stalled_count: Number(row?.stalled_count ?? 0),
      not_started_count: Number(row?.not_started_count ?? 0),
      expiring_within_30d_count: Number(row?.expiring_within_30d_count ?? 0),
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

  async countCourses(tx: TenantTx, q?: string): Promise<number> {
    return this.countProducts(tx, "course", { q });
  },

  async listCourses(tx: TenantTx, query: ProgressCoursesQuery): Promise<ProgressCourseRow[]> {
    const rows = await this.listProducts(tx, "course", query);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      enrolled_count: row.enrolled_count,
      quiz_count: row.quiz_count,
    }));
  },

  async countProducts(
    tx: TenantTx,
    productType: ProgressProductType | ScoreProductType,
    filters?: { q?: string; status?: ProductPublishStatus },
  ): Promise<number> {
    const q = filters?.q;
    const status = filters?.status ?? null;
    if (productType === "course") {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from courses c
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
          and (${status}::text is null or c.status::text = ${status})
          and (
            ${q ?? null}::text is null
            or lower(c.title) like '%' || lower(${q ?? null}) || '%'
            or lower(c.slug) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return Number(rows[0]?.count ?? 0);
    }
    if (productType === "test_series") {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from test_series ts
        where ts.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ts.deleted_at is null
          and (${status}::text is null or ts.status::text = ${status})
          and (
            ${q ?? null}::text is null
            or lower(ts.title) like '%' || lower(${q ?? null}) || '%'
            or lower(ts.slug) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return Number(rows[0]?.count ?? 0);
    }
    if (productType === "bundle") {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from bundles b
        where b.tenant_id = current_setting('app.tenant_id', true)::uuid
          and b.deleted_at is null
          and (${status}::text is null or b.status::text = ${status})
          and (
            ${q ?? null}::text is null
            or lower(b.title) like '%' || lower(${q ?? null}) || '%'
            or lower(b.slug) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return Number(rows[0]?.count ?? 0);
    }
    if (productType === "subscription") {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from learner_subscription_plans p
        where p.tenant_id = current_setting('app.tenant_id', true)::uuid
          and p.deleted_at is null
          and (${status}::text is null or p.status::text = ${status})
          and (
            ${q ?? null}::text is null
            or lower(p.title) like '%' || lower(${q ?? null}) || '%'
            or lower(p.slug) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return Number(rows[0]?.count ?? 0);
    }
    if (productType === "mock_test") {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from mock_tests mt
        where mt.tenant_id = current_setting('app.tenant_id', true)::uuid
          and mt.deleted_at is null
          and (${status}::text is null or mt.status::text = ${status})
          and (
            ${q ?? null}::text is null
            or lower(mt.title) like '%' || lower(${q ?? null}) || '%'
            or lower(mt.slug) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return Number(rows[0]?.count ?? 0);
    }
    return 0;
  },

  async summarizeProducts(
    tx: TenantTx,
    productType: ProgressProductType | ScoreProductType,
    filters?: { q?: string; status?: ProductPublishStatus },
  ): Promise<{ productCount: number; enrolmentCount: number }> {
    const q = filters?.q;
    const status = filters?.status ?? null;
    if (productType === "course") {
      const rows = await tx.$queryRaw<Array<{ product_count: number; enrolment_count: number }>>`
        select
          count(*)::int as product_count,
          coalesce(sum(enr.enrolled_count), 0)::int as enrolment_count
        from courses c
        left join lateral (
          select count(*)::int as enrolled_count
          from enrollments e
          where e.course_id = c.id
            and e.tenant_id = c.tenant_id
        ) enr on true
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
          and (${status}::text is null or c.status::text = ${status})
          and (
            ${q ?? null}::text is null
            or lower(c.title) like '%' || lower(${q ?? null}) || '%'
            or lower(c.slug) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return {
        productCount: Number(rows[0]?.product_count ?? 0),
        enrolmentCount: Number(rows[0]?.enrolment_count ?? 0),
      };
    }
    if (productType === "test_series") {
      const rows = await tx.$queryRaw<Array<{ product_count: number; enrolment_count: number }>>`
        select
          count(*)::int as product_count,
          coalesce(sum(enr.enrolled_count), 0)::int as enrolment_count
        from test_series ts
        left join lateral (
          select count(*)::int as enrolled_count
          from test_series_enrollments tse
          where tse.test_series_id = ts.id
            and tse.tenant_id = ts.tenant_id
        ) enr on true
        where ts.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ts.deleted_at is null
          and (${status}::text is null or ts.status::text = ${status})
          and (
            ${q ?? null}::text is null
            or lower(ts.title) like '%' || lower(${q ?? null}) || '%'
            or lower(ts.slug) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return {
        productCount: Number(rows[0]?.product_count ?? 0),
        enrolmentCount: Number(rows[0]?.enrolment_count ?? 0),
      };
    }
    if (productType === "bundle") {
      const rows = await tx.$queryRaw<Array<{ product_count: number; enrolment_count: number }>>`
        select
          count(*)::int as product_count,
          coalesce(sum(enr.enrolled_count), 0)::int as enrolment_count
        from bundles b
        left join lateral (
          select count(*)::int as enrolled_count
          from bundle_enrollments be
          where be.bundle_id = b.id
            and be.tenant_id = b.tenant_id
        ) enr on true
        where b.tenant_id = current_setting('app.tenant_id', true)::uuid
          and b.deleted_at is null
          and (${status}::text is null or b.status::text = ${status})
          and (
            ${q ?? null}::text is null
            or lower(b.title) like '%' || lower(${q ?? null}) || '%'
            or lower(b.slug) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return {
        productCount: Number(rows[0]?.product_count ?? 0),
        enrolmentCount: Number(rows[0]?.enrolment_count ?? 0),
      };
    }
    if (productType === "subscription") {
      const rows = await tx.$queryRaw<Array<{ product_count: number; enrolment_count: number }>>`
        select
          count(*)::int as product_count,
          coalesce(sum(enr.enrolled_count), 0)::int as enrolment_count
        from learner_subscription_plans p
        left join lateral (
          select count(*)::int as enrolled_count
          from learner_subscription_enrollments lse
          where lse.plan_id = p.id
            and lse.tenant_id = p.tenant_id
        ) enr on true
        where p.tenant_id = current_setting('app.tenant_id', true)::uuid
          and p.deleted_at is null
          and (${status}::text is null or p.status::text = ${status})
          and (
            ${q ?? null}::text is null
            or lower(p.title) like '%' || lower(${q ?? null}) || '%'
            or lower(p.slug) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return {
        productCount: Number(rows[0]?.product_count ?? 0),
        enrolmentCount: Number(rows[0]?.enrolment_count ?? 0),
      };
    }
    if (productType === "mock_test") {
      const rows = await tx.$queryRaw<Array<{ product_count: number; enrolment_count: number }>>`
        select
          count(*)::int as product_count,
          coalesce(sum(enr.enrolled_count), 0)::int as enrolment_count
        from mock_tests mt
        left join lateral (
          select count(*)::int as enrolled_count
          from mock_test_enrollments mte
          where mte.mock_test_id = mt.id
            and mte.tenant_id = mt.tenant_id
        ) enr on true
        where mt.tenant_id = current_setting('app.tenant_id', true)::uuid
          and mt.deleted_at is null
          and (${status}::text is null or mt.status::text = ${status})
          and (
            ${q ?? null}::text is null
            or lower(mt.title) like '%' || lower(${q ?? null}) || '%'
            or lower(mt.slug) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return {
        productCount: Number(rows[0]?.product_count ?? 0),
        enrolmentCount: Number(rows[0]?.enrolment_count ?? 0),
      };
    }
    return { productCount: 0, enrolmentCount: 0 };
  },

  async listProducts(
    tx: TenantTx,
    productType: ProgressProductType | ScoreProductType,
    query: ProductListQuery,
  ): Promise<ProgressProductRow[]> {
    const filters = productListFilters(query);
    const skip = (filters.page - 1) * filters.limit;
    const q = filters.q ?? null;
    const status = filters.status ?? null;
    const sortBy = filters.sortBy;
    const sortDir = filters.sortDir;

    if (productType === "course") {
      return tx.$queryRaw<ProgressProductRow[]>`
        select
          c.id::text as id,
          c.title,
          c.slug,
          c.status::text as status,
          coalesce(enr.enrolled_count, 0)::int as enrolled_count,
          coalesce(qz.quiz_count, 0)::int as quiz_count,
          null::text as assessment_id,
          prog.avg_completion_pct,
          coalesce(prog.band_not_started, 0)::int as band_not_started,
          coalesce(prog.band_early, 0)::int as band_early,
          coalesce(prog.band_in_progress, 0)::int as band_in_progress,
          coalesce(prog.band_nearly_done, 0)::int as band_nearly_done,
          coalesce(prog.band_complete, 0)::int as band_complete,
          coalesce(prog.not_started_count, 0)::int as not_started_count,
          prog.last_activity_at
        from courses c
        left join lateral (
          select count(*)::int as enrolled_count
          from enrollments e
          where e.course_id = c.id
            and e.tenant_id = c.tenant_id
        ) enr on true
        left join lateral (
          select count(distinct coalesce(
            l.content_json->'content'->>'assessmentId',
            l.content_json->>'assessmentId'
          ))::int as quiz_count
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
          with course_totals as (
            select count(l.id)::int as total_lessons
            from course_modules m
            join lessons l
              on l.module_id = m.id
              and l.tenant_id = m.tenant_id
              and l.deleted_at is null
            where m.course_id = c.id
              and m.tenant_id = c.tenant_id
              and m.deleted_at is null
          ),
          enrolments as (
            select
              e.membership_id,
              e.enrolled_at,
              case
                when coalesce((select total_lessons from course_totals), 0) = 0 then 0
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
                  ) / (select total_lessons from course_totals)::numeric
                ) * 100)::int
              end as completion_pct,
              (
                select max(coalesce(lp.last_seen_at, lp.updated_at))
                from lesson_progress lp
                join lessons cl on cl.id = lp.lesson_id and cl.tenant_id = lp.tenant_id
                join course_modules cm on cm.id = cl.module_id and cm.tenant_id = cl.tenant_id
                where lp.membership_id = e.membership_id
                  and lp.tenant_id = e.tenant_id
                  and cm.course_id = e.course_id
                  and cl.deleted_at is null
                  and cm.deleted_at is null
              ) as last_seen_at
            from enrollments e
            where e.course_id = c.id
              and e.tenant_id = c.tenant_id
              and e.status = 'active'
              and (e.expires_at is null or e.expires_at > now())
          )
          select
            avg(completion_pct::numeric)::float as avg_completion_pct,
            count(*) filter (where completion_pct = 0)::int as band_not_started,
            count(*) filter (where completion_pct > 0 and completion_pct < 25)::int as band_early,
            count(*) filter (where completion_pct >= 25 and completion_pct < 75)::int as band_in_progress,
            count(*) filter (where completion_pct >= 75 and completion_pct < 100)::int as band_nearly_done,
            count(*) filter (where completion_pct = 100)::int as band_complete,
            count(*) filter (where completion_pct = 0)::int as not_started_count,
            max(greatest(enrolled_at, coalesce(last_seen_at, enrolled_at))) as last_activity_at
          from enrolments
        ) prog on true
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
          and (${status}::text is null or c.status::text = ${status})
          and (
            ${q}::text is null
            or lower(c.title) like '%' || lower(${q}) || '%'
            or lower(c.slug) like '%' || lower(${q}) || '%'
          )
        order by
          case when ${sortBy} = 'enrolled_count' and ${sortDir} = 'asc' then coalesce(enr.enrolled_count, 0) end asc nulls last,
          case when ${sortBy} = 'enrolled_count' and ${sortDir} = 'desc' then coalesce(enr.enrolled_count, 0) end desc nulls last,
          case when ${sortBy} = 'avg_completion' and ${sortDir} = 'asc' then prog.avg_completion_pct end asc nulls last,
          case when ${sortBy} = 'avg_completion' and ${sortDir} = 'desc' then prog.avg_completion_pct end desc nulls last,
          case when ${sortBy} = 'last_activity' and ${sortDir} = 'asc' then prog.last_activity_at end asc nulls last,
          case when ${sortBy} = 'last_activity' and ${sortDir} = 'desc' then prog.last_activity_at end desc nulls last,
          case when ${sortBy} = 'title' and ${sortDir} = 'asc' then c.title end asc,
          case when ${sortBy} = 'title' and ${sortDir} = 'desc' then c.title end desc,
          c.title asc
        limit ${filters.limit}
        offset ${skip}
      `;
    }

    if (productType === "test_series") {
      return tx.$queryRaw<ProgressProductRow[]>`
        select
          ts.id::text as id,
          ts.title,
          ts.slug,
          ts.status::text as status,
          coalesce(enr.enrolled_count, 0)::int as enrolled_count,
          coalesce(items.item_count, 0)::int as quiz_count,
          null::text as assessment_id,
          null::float as avg_completion_pct,
          0::int as band_not_started,
          0::int as band_early,
          0::int as band_in_progress,
          0::int as band_nearly_done,
          0::int as band_complete,
          0::int as not_started_count,
          null::timestamptz as last_activity_at
        from test_series ts
        left join lateral (
          select count(*)::int as enrolled_count
          from test_series_enrollments tse
          where tse.test_series_id = ts.id
            and tse.tenant_id = ts.tenant_id
        ) enr on true
        left join lateral (
          select count(*)::int as item_count
          from test_series_items tsi
          where tsi.test_series_id = ts.id
            and tsi.tenant_id = ts.tenant_id
        ) items on true
        where ts.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ts.deleted_at is null
          and (${status}::text is null or ts.status::text = ${status})
          and (
            ${q}::text is null
            or lower(ts.title) like '%' || lower(${q}) || '%'
            or lower(ts.slug) like '%' || lower(${q}) || '%'
          )
        order by
          case when ${sortBy} = 'enrolled_count' and ${sortDir} = 'asc' then coalesce(enr.enrolled_count, 0) end asc nulls last,
          case when ${sortBy} = 'enrolled_count' and ${sortDir} = 'desc' then coalesce(enr.enrolled_count, 0) end desc nulls last,
          case when ${sortBy} = 'title' and ${sortDir} = 'asc' then ts.title end asc,
          case when ${sortBy} = 'title' and ${sortDir} = 'desc' then ts.title end desc,
          ts.title asc
        limit ${filters.limit}
        offset ${skip}
      `;
    }

    if (productType === "bundle") {
      return tx.$queryRaw<ProgressProductRow[]>`
        select
          b.id::text as id,
          b.title,
          b.slug,
          b.status::text as status,
          coalesce(enr.enrolled_count, 0)::int as enrolled_count,
          coalesce(items.item_count, 0)::int as quiz_count,
          null::text as assessment_id,
          null::float as avg_completion_pct,
          0::int as band_not_started,
          0::int as band_early,
          0::int as band_in_progress,
          0::int as band_nearly_done,
          0::int as band_complete,
          0::int as not_started_count,
          null::timestamptz as last_activity_at
        from bundles b
        left join lateral (
          select count(*)::int as enrolled_count
          from bundle_enrollments be
          where be.bundle_id = b.id
            and be.tenant_id = b.tenant_id
        ) enr on true
        left join lateral (
          select count(*)::int as item_count
          from bundle_items bi
          where bi.bundle_id = b.id
            and bi.tenant_id = b.tenant_id
        ) items on true
        where b.tenant_id = current_setting('app.tenant_id', true)::uuid
          and b.deleted_at is null
          and (${status}::text is null or b.status::text = ${status})
          and (
            ${q}::text is null
            or lower(b.title) like '%' || lower(${q}) || '%'
            or lower(b.slug) like '%' || lower(${q}) || '%'
          )
        order by
          case when ${sortBy} = 'enrolled_count' and ${sortDir} = 'asc' then coalesce(enr.enrolled_count, 0) end asc nulls last,
          case when ${sortBy} = 'enrolled_count' and ${sortDir} = 'desc' then coalesce(enr.enrolled_count, 0) end desc nulls last,
          case when ${sortBy} = 'title' and ${sortDir} = 'asc' then b.title end asc,
          case when ${sortBy} = 'title' and ${sortDir} = 'desc' then b.title end desc,
          b.title asc
        limit ${filters.limit}
        offset ${skip}
      `;
    }

    if (productType === "subscription") {
      return tx.$queryRaw<ProgressProductRow[]>`
        select
          p.id::text as id,
          p.title,
          p.slug,
          p.status::text as status,
          coalesce(enr.enrolled_count, 0)::int as enrolled_count,
          coalesce(items.item_count, 0)::int as quiz_count,
          null::text as assessment_id,
          null::float as avg_completion_pct,
          0::int as band_not_started,
          0::int as band_early,
          0::int as band_in_progress,
          0::int as band_nearly_done,
          0::int as band_complete,
          0::int as not_started_count,
          null::timestamptz as last_activity_at
        from learner_subscription_plans p
        left join lateral (
          select count(*)::int as enrolled_count
          from learner_subscription_enrollments lse
          where lse.plan_id = p.id
            and lse.tenant_id = p.tenant_id
        ) enr on true
        left join lateral (
          select count(*)::int as item_count
          from learner_subscription_plan_items lspi
          where lspi.plan_id = p.id
            and lspi.tenant_id = p.tenant_id
        ) items on true
        where p.tenant_id = current_setting('app.tenant_id', true)::uuid
          and p.deleted_at is null
          and (${status}::text is null or p.status::text = ${status})
          and (
            ${q}::text is null
            or lower(p.title) like '%' || lower(${q}) || '%'
            or lower(p.slug) like '%' || lower(${q}) || '%'
          )
        order by
          case when ${sortBy} = 'enrolled_count' and ${sortDir} = 'asc' then coalesce(enr.enrolled_count, 0) end asc nulls last,
          case when ${sortBy} = 'enrolled_count' and ${sortDir} = 'desc' then coalesce(enr.enrolled_count, 0) end desc nulls last,
          case when ${sortBy} = 'title' and ${sortDir} = 'asc' then p.title end asc,
          case when ${sortBy} = 'title' and ${sortDir} = 'desc' then p.title end desc,
          p.title asc
        limit ${filters.limit}
        offset ${skip}
      `;
    }

    if (productType === "mock_test") {
      return tx.$queryRaw<ProgressProductRow[]>`
        select
          mt.id::text as id,
          mt.title,
          mt.slug,
          mt.status::text as status,
          coalesce(enr.enrolled_count, 0)::int as enrolled_count,
          1::int as quiz_count,
          mt.assessment_id::text as assessment_id,
          null::float as avg_completion_pct,
          0::int as band_not_started,
          0::int as band_early,
          0::int as band_in_progress,
          0::int as band_nearly_done,
          0::int as band_complete,
          0::int as not_started_count,
          null::timestamptz as last_activity_at
        from mock_tests mt
        left join lateral (
          select count(*)::int as enrolled_count
          from mock_test_enrollments mte
          where mte.mock_test_id = mt.id
            and mte.tenant_id = mt.tenant_id
        ) enr on true
        where mt.tenant_id = current_setting('app.tenant_id', true)::uuid
          and mt.deleted_at is null
          and (${status}::text is null or mt.status::text = ${status})
          and (
            ${q}::text is null
            or lower(mt.title) like '%' || lower(${q}) || '%'
            or lower(mt.slug) like '%' || lower(${q}) || '%'
          )
        order by
          case when ${sortBy} = 'enrolled_count' and ${sortDir} = 'asc' then coalesce(enr.enrolled_count, 0) end asc nulls last,
          case when ${sortBy} = 'enrolled_count' and ${sortDir} = 'desc' then coalesce(enr.enrolled_count, 0) end desc nulls last,
          case when ${sortBy} = 'title' and ${sortDir} = 'asc' then mt.title end asc,
          case when ${sortBy} = 'title' and ${sortDir} = 'desc' then mt.title end desc,
          mt.title asc
        limit ${filters.limit}
        offset ${skip}
      `;
    }
    return [];
  },

  async countProgressLearners(tx: TenantTx, filter: ProgressLearnersFilter): Promise<number> {
    if (filter.productType === "course") {
      return this.countCourseProgressLearners(tx, filter);
    }
    if (filter.productType === "test_series") {
      return this.countTestSeriesProgressLearners(tx, filter);
    }
    if (filter.productType === "bundle") {
      return this.countBundleProgressLearners(tx, filter);
    }
    if (filter.productType === "subscription") {
      return this.countSubscriptionProgressLearners(tx, filter);
    }
    return 0;
  },

  async countCourseProgressLearners(
    tx: TenantTx,
    filter: ProgressLearnersFilter,
  ): Promise<number> {
    const view = filter.view ?? "all";
    const completionBand = filter.completionBand ?? null;
    const activityStatus = filter.activityStatus ?? null;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with course_lessons as (
        select l.id
        from lessons l
        inner join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
        where m.course_id = ${filter.productId}::uuid
          and l.deleted_at is null
          and m.deleted_at is null
      ),
      roster as (
        select
          e.id as enrollment_id,
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
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.course_id = ${filter.productId}::uuid
          and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
          and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
          and (
            ${filter.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.learnerName ?? null}) || '%'
          )
          and (
            ${filter.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${filter.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
          )
      ),
      scored as (
        select
          *,
          case
            when completion_pct = 0 then 'not_started'
            when last_activity_at < now() - interval '14 days' then 'stalled'
            else 'active'
          end as activity_status,
          case
            when completion_pct = 0 then 'not_started'
            when completion_pct > 0 and completion_pct < 25 then 'early'
            when completion_pct >= 25 and completion_pct < 75 then 'in_progress'
            when completion_pct >= 75 and completion_pct < 100 then 'nearly_done'
            else 'complete'
          end as completion_band
        from roster
      )
      select count(*)::bigint as count
      from scored
      where (${view}::text = 'all' or
        (${view}::text = 'stalled' and activity_status = 'stalled') or
        (${view}::text = 'not_started' and activity_status = 'not_started') or
        (${view}::text = 'nearly_done' and completion_band = 'nearly_done') or
        (${view}::text = 'completed' and completion_band = 'complete'))
        and (${completionBand}::text is null or completion_band = ${completionBand})
        and (${activityStatus}::text is null or activity_status = ${activityStatus})
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countTestSeriesProgressLearners(
    tx: TenantTx,
    filter: ProgressLearnersFilter,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from test_series_enrollments e
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and e.test_series_id = ${filter.productId}::uuid
        and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
        and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.enrolledFrom ?? null}::timestamptz is null
          or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
        )
        and (
          ${filter.enrolledTo ?? null}::timestamptz is null
          or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countBundleProgressLearners(
    tx: TenantTx,
    filter: ProgressLearnersFilter,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from bundle_enrollments e
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and e.bundle_id = ${filter.productId}::uuid
        and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
        and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.enrolledFrom ?? null}::timestamptz is null
          or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
        )
        and (
          ${filter.enrolledTo ?? null}::timestamptz is null
          or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countSubscriptionProgressLearners(
    tx: TenantTx,
    filter: ProgressLearnersFilter,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from learner_subscription_enrollments e
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and e.plan_id = ${filter.productId}::uuid
        and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
        and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.enrolledFrom ?? null}::timestamptz is null
          or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
        )
        and (
          ${filter.enrolledTo ?? null}::timestamptz is null
          or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listProgressLearners(
    tx: TenantTx,
    productType: ProgressProductType,
    productId: string,
    query: ProgressLearnersQuery,
  ): Promise<ProgressLearnerRow[]> {
    if (productType === "course") {
      return this.listCourseProgressLearners(tx, productId, query);
    }
    if (productType === "test_series") {
      return this.listTestSeriesProgressLearners(tx, productId, query);
    }
    if (productType === "bundle") {
      return this.listBundleProgressLearners(tx, productId, query);
    }
    if (productType === "subscription") {
      return this.listSubscriptionProgressLearners(tx, productId, query);
    }
    return [];
  },

  async listCourseProgressLearners(
    tx: TenantTx,
    courseId: string,
    query: ProgressLearnersQuery,
  ): Promise<ProgressLearnerRow[]> {
    const skip = (query.page - 1) * query.limit;
    const view = query.view ?? "all";
    const completionBand = query.completionBand ?? null;
    const activityStatus = query.activityStatus ?? null;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with course_lessons as (
        select l.id, l.title, m.position as module_position, l.position as lesson_position
        from lessons l
        inner join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
        where m.course_id = ${courseId}::uuid
          and l.deleted_at is null
          and m.deleted_at is null
      ),
      roster as (
        select
          e.id as enrollment_id,
          e.membership_id,
          e.course_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          (
            select count(*)::int
            from lesson_progress lp
            inner join course_lessons cl on cl.id = lp.lesson_id
            where lp.membership_id = e.membership_id
              and lp.tenant_id = e.tenant_id
              and lp.status = 'completed'
          ) as completed_lessons,
          (select count(*)::int from course_lessons) as total_lessons,
          e.enrolled_type,
          e.status,
          e.enrolled_at,
          e.expires_at,
          (
            select cl.title
            from lesson_progress lp
            inner join course_lessons cl on cl.id = lp.lesson_id
            where lp.membership_id = e.membership_id
              and lp.tenant_id = e.tenant_id
            order by coalesce(lp.last_seen_at, lp.updated_at) desc nulls last
            limit 1
          ) as last_lesson_title,
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
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.course_id = ${courseId}::uuid
          and (${query.status ?? null}::text is null or e.status = ${query.status ?? null})
          and (${query.enrolledType ?? null}::text is null or e.enrolled_type = ${query.enrolledType ?? null})
          and (
            ${query.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.learnerName ?? null}) || '%'
          )
          and (
            ${query.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${query.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${query.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${query.enrolledTo ?? null}::timestamptz
          )
      ),
      scored as (
        select
          enrollment_id,
          membership_id,
          course_id,
          learner_name,
          email,
          case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0
          end as completion_pct,
          completed_lessons,
          total_lessons,
          enrolled_type,
          status,
          last_lesson_title,
          last_activity_at,
          enrolled_at,
          expires_at,
          case
            when total_lessons = 0 or completed_lessons = 0 then 'not_started'
            when last_activity_at < now() - interval '14 days' then 'stalled'
            else 'active'
          end as activity_status,
          case
            when total_lessons = 0 or completed_lessons = 0 then 'not_started'
            when round((completed_lessons::numeric / nullif(total_lessons, 0)::numeric) * 100) < 25 then 'early'
            when round((completed_lessons::numeric / nullif(total_lessons, 0)::numeric) * 100) < 75 then 'in_progress'
            when round((completed_lessons::numeric / nullif(total_lessons, 0)::numeric) * 100) < 100 then 'nearly_done'
            else 'complete'
          end as completion_band
        from roster
      )
      select
        enrollment_id::text,
        membership_id::text,
        course_id::text,
        learner_name,
        email,
        completion_pct,
        completed_lessons,
        total_lessons,
        enrolled_type,
        status,
        activity_status,
        last_lesson_title,
        last_activity_at,
        enrolled_at,
        expires_at
      from scored
      where (${view}::text = 'all' or
        (${view}::text = 'stalled' and activity_status = 'stalled') or
        (${view}::text = 'not_started' and activity_status = 'not_started') or
        (${view}::text = 'nearly_done' and completion_band = 'nearly_done') or
        (${view}::text = 'completed' and completion_band = 'complete'))
        and (${completionBand}::text is null or completion_band = ${completionBand})
        and (${activityStatus}::text is null or activity_status = ${activityStatus})
      order by
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'asc' then completion_pct end asc,
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'desc' then completion_pct end desc,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then learner_name end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then learner_name end desc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'asc' then expires_at end asc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'desc' then expires_at end desc nulls last,
        case when ${query.sortBy} = 'last_activity_at' and ${query.sortDir} = 'asc' then last_activity_at end asc nulls last,
        case when ${query.sortBy} = 'last_activity_at' and ${query.sortDir} = 'desc' then last_activity_at end desc nulls last,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'asc' then enrolled_at end asc,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'desc' then enrolled_at end desc,
        enrollment_id desc
      limit ${query.limit}
      offset ${skip}
    `;

    return mapProgressLearnerRows(rows);
  },

  async listTestSeriesProgressLearners(
    tx: TenantTx,
    productId: string,
    query: ProgressLearnersQuery,
  ): Promise<ProgressLearnerRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with series_items as (
        select tsi.id
        from test_series_items tsi
        where tsi.test_series_id = ${productId}::uuid
          and tsi.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      roster as (
        select
          e.id as enrollment_id,
          e.membership_id,
          e.test_series_id as course_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          (
            select count(*)::int
            from test_series_item_progress tip
            inner join series_items si on si.id = tip.test_series_item_id
            where tip.membership_id = e.membership_id
              and tip.tenant_id = e.tenant_id
              and tip.status = 'completed'
          ) as completed_lessons,
          (select count(*)::int from series_items) as total_lessons,
          e.enrolled_type,
          e.status,
          e.enrolled_at,
          e.expires_at
        from test_series_enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.test_series_id = ${productId}::uuid
          and (${query.status ?? null}::text is null or e.status = ${query.status ?? null})
          and (${query.enrolledType ?? null}::text is null or e.enrolled_type = ${query.enrolledType ?? null})
          and (
            ${query.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.learnerName ?? null}) || '%'
          )
          and (
            ${query.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${query.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${query.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${query.enrolledTo ?? null}::timestamptz
          )
      )
      select
        enrollment_id::text,
        membership_id::text,
        course_id::text,
        learner_name,
        email,
        case when total_lessons > 0
          then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
          else 0
        end as completion_pct,
        completed_lessons,
        total_lessons,
        enrolled_type,
        status,
        enrolled_at,
        expires_at
      from roster
      order by
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'asc'
          then case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0 end end asc,
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'desc'
          then case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0 end end desc,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then learner_name end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then learner_name end desc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'asc' then expires_at end asc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'desc' then expires_at end desc nulls last,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'asc' then enrolled_at end asc,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'desc' then enrolled_at end desc,
        enrollment_id desc
      limit ${query.limit}
      offset ${skip}
    `;
    return mapProgressLearnerRows(rows);
  },

  async listBundleProgressLearners(
    tx: TenantTx,
    productId: string,
    query: ProgressLearnersQuery,
  ): Promise<ProgressLearnerRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with bundle_items_cte as (
        select bi.id, bi.item_kind, bi.ref_id
        from bundle_items bi
        where bi.bundle_id = ${productId}::uuid
          and bi.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      roster as (
        select
          e.id as enrollment_id,
          e.membership_id,
          e.bundle_id as course_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          (
            select count(*)::int
            from bundle_items_cte bi
            where (
              (bi.item_kind = 'course' and (
                select case when lt.total > 0 and lt.completed >= lt.total then true else false end
                from (
                  select
                    (
                      select count(*)::int
                      from lessons l
                      join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                      where cm.course_id = bi.ref_id
                        and l.deleted_at is null
                        and cm.deleted_at is null
                    ) as total,
                    (
                      select count(*)::int
                      from lesson_progress lp
                      join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id
                      join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                      where cm.course_id = bi.ref_id
                        and lp.membership_id = e.membership_id
                        and lp.tenant_id = e.tenant_id
                        and lp.status = 'completed'
                        and l.deleted_at is null
                        and cm.deleted_at is null
                    ) as completed
                ) lt
              ))
              or (bi.item_kind = 'mock_test' and exists (
                select 1
                from attempts at
                join mock_tests mt on mt.assessment_id = at.assessment_id and mt.tenant_id = at.tenant_id
                where mt.id = bi.ref_id
                  and mt.deleted_at is null
                  and at.membership_id = e.membership_id
                  and at.tenant_id = e.tenant_id
                  and (at.submitted_at is not null or at.score_pct is not null)
              ))
              or (bi.item_kind = 'test_series' and (
                select count(*)::int from test_series_items tsi
                where tsi.test_series_id = bi.ref_id
                  and tsi.tenant_id = e.tenant_id
              ) > 0
              and (
                select count(*)::int from test_series_items tsi
                where tsi.test_series_id = bi.ref_id
                  and tsi.tenant_id = e.tenant_id
              ) = (
                select count(*)::int
                from test_series_item_progress tip
                join test_series_items tsi on tsi.id = tip.test_series_item_id and tsi.tenant_id = tip.tenant_id
                where tsi.test_series_id = bi.ref_id
                  and tip.membership_id = e.membership_id
                  and tip.tenant_id = e.tenant_id
                  and tip.status = 'completed'
              ))
            )
          ) as completed_lessons,
          (select count(*)::int from bundle_items_cte) as total_lessons,
          e.enrolled_type,
          e.status,
          e.enrolled_at,
          e.expires_at
        from bundle_enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.bundle_id = ${productId}::uuid
          and (${query.status ?? null}::text is null or e.status = ${query.status ?? null})
          and (${query.enrolledType ?? null}::text is null or e.enrolled_type = ${query.enrolledType ?? null})
          and (
            ${query.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.learnerName ?? null}) || '%'
          )
          and (
            ${query.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${query.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${query.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${query.enrolledTo ?? null}::timestamptz
          )
      )
      select
        enrollment_id::text,
        membership_id::text,
        course_id::text,
        learner_name,
        email,
        case when total_lessons > 0
          then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
          else 0
        end as completion_pct,
        completed_lessons,
        total_lessons,
        enrolled_type,
        status,
        enrolled_at,
        expires_at
      from roster
      order by
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'asc'
          then case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0 end end asc,
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'desc'
          then case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0 end end desc,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then learner_name end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then learner_name end desc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'asc' then expires_at end asc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'desc' then expires_at end desc nulls last,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'asc' then enrolled_at end asc,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'desc' then enrolled_at end desc,
        enrollment_id desc
      limit ${query.limit}
      offset ${skip}
    `;
    return mapProgressLearnerRows(rows);
  },

  async listSubscriptionProgressLearners(
    tx: TenantTx,
    productId: string,
    query: ProgressLearnersQuery,
  ): Promise<ProgressLearnerRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with plan_items_cte as (
        select lspi.id, lspi.item_kind, lspi.ref_id
        from learner_subscription_plan_items lspi
        where lspi.plan_id = ${productId}::uuid
          and lspi.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      roster as (
        select
          e.id as enrollment_id,
          e.membership_id,
          e.plan_id as course_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          (
            select count(*)::int
            from plan_items_cte pi
            where (
              (pi.item_kind = 'course' and (
                select case when lt.total > 0 and lt.completed >= lt.total then true else false end
                from (
                  select
                    (
                      select count(*)::int
                      from lessons l
                      join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                      where cm.course_id = pi.ref_id
                        and l.deleted_at is null
                        and cm.deleted_at is null
                    ) as total,
                    (
                      select count(*)::int
                      from lesson_progress lp
                      join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id
                      join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                      where cm.course_id = pi.ref_id
                        and lp.membership_id = e.membership_id
                        and lp.tenant_id = e.tenant_id
                        and lp.status = 'completed'
                        and l.deleted_at is null
                        and cm.deleted_at is null
                    ) as completed
                ) lt
              ))
              or (pi.item_kind = 'mock_test' and exists (
                select 1
                from attempts at
                join mock_tests mt on mt.assessment_id = at.assessment_id and mt.tenant_id = at.tenant_id
                where mt.id = pi.ref_id
                  and mt.deleted_at is null
                  and at.membership_id = e.membership_id
                  and at.tenant_id = e.tenant_id
                  and (at.submitted_at is not null or at.score_pct is not null)
              ))
              or (pi.item_kind = 'test_series' and (
                select count(*)::int from test_series_items tsi
                where tsi.test_series_id = pi.ref_id
                  and tsi.tenant_id = e.tenant_id
              ) > 0
              and (
                select count(*)::int from test_series_items tsi
                where tsi.test_series_id = pi.ref_id
                  and tsi.tenant_id = e.tenant_id
              ) = (
                select count(*)::int
                from test_series_item_progress tip
                join test_series_items tsi on tsi.id = tip.test_series_item_id and tsi.tenant_id = tip.tenant_id
                where tsi.test_series_id = pi.ref_id
                  and tip.membership_id = e.membership_id
                  and tip.tenant_id = e.tenant_id
                  and tip.status = 'completed'
              ))
              or (pi.item_kind = 'bundle' and exists (
                select 1
                from bundle_enrollments be
                where be.bundle_id = pi.ref_id
                  and be.membership_id = e.membership_id
                  and be.tenant_id = e.tenant_id
                  and be.completed_at is not null
              ))
            )
          ) as completed_lessons,
          (select count(*)::int from plan_items_cte) as total_lessons,
          e.enrolled_type,
          e.status,
          e.enrolled_at,
          e.expires_at
        from learner_subscription_enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.plan_id = ${productId}::uuid
          and (${query.status ?? null}::text is null or e.status = ${query.status ?? null})
          and (${query.enrolledType ?? null}::text is null or e.enrolled_type = ${query.enrolledType ?? null})
          and (
            ${query.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.learnerName ?? null}) || '%'
          )
          and (
            ${query.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${query.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${query.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${query.enrolledTo ?? null}::timestamptz
          )
      )
      select
        enrollment_id::text,
        membership_id::text,
        course_id::text,
        learner_name,
        email,
        case when total_lessons > 0
          then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
          else 0
        end as completion_pct,
        completed_lessons,
        total_lessons,
        enrolled_type,
        status,
        enrolled_at,
        expires_at
      from roster
      order by
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'asc'
          then case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0 end end asc,
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'desc'
          then case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0 end end desc,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then learner_name end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then learner_name end desc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'asc' then expires_at end asc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'desc' then expires_at end desc nulls last,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'asc' then enrolled_at end asc,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'desc' then enrolled_at end desc,
        enrollment_id desc
      limit ${query.limit}
      offset ${skip}
    `;
    return mapProgressLearnerRows(rows);
  },

  async listProgressMembershipIds(
    tx: TenantTx,
    filter: ProgressLearnersFilter,
  ): Promise<string[]> {
    if (filter.productType === "test_series") {
      const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
        select distinct e.membership_id::text as membership_id
        from test_series_enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.test_series_id = ${filter.productId}::uuid
          and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
          and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
          and (
            ${filter.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.learnerName ?? null}) || '%'
          )
          and (
            ${filter.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${filter.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
          )
        order by membership_id
        limit 2000
      `;
      return rows.map((row) => row.membership_id);
    }
    if (filter.productType === "bundle") {
      const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
        select distinct e.membership_id::text as membership_id
        from bundle_enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.bundle_id = ${filter.productId}::uuid
          and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
          and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
          and (
            ${filter.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.learnerName ?? null}) || '%'
          )
          and (
            ${filter.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${filter.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
          )
        order by membership_id
        limit 2000
      `;
      return rows.map((row) => row.membership_id);
    }
    if (filter.productType === "subscription") {
      const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
        select distinct e.membership_id::text as membership_id
        from learner_subscription_enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.plan_id = ${filter.productId}::uuid
          and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
          and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
          and (
            ${filter.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.learnerName ?? null}) || '%'
          )
          and (
            ${filter.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${filter.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
          )
        order by membership_id
        limit 2000
      `;
      return rows.map((row) => row.membership_id);
    }

    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select distinct e.membership_id::text as membership_id
      from enrollments e
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and e.course_id = ${filter.productId}::uuid
        and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
        and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.enrolledFrom ?? null}::timestamptz is null
          or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
        )
        and (
          ${filter.enrolledTo ?? null}::timestamptz is null
          or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
        )
      order by membership_id
      limit 2000
    `;
    return rows.map((row) => row.membership_id);
  },

  async countQuizzes(tx: TenantTx, courseId: string, q?: string): Promise<number> {
    return this.countProductQuizzes(tx, "course", courseId, q);
  },

  async countProductQuizzes(
    tx: TenantTx,
    productType: ScoreProductType,
    productId: string,
    q?: string,
  ): Promise<number> {
    if (productType === "course") {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(distinct a.id)::bigint as count
        from assessments a
        join lessons l on l.tenant_id = a.tenant_id
          and l.deleted_at is null
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
          and cm.course_id = ${productId}::uuid
          and (
            ${q ?? null}::text is null
            or lower(a.title) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return Number(rows[0]?.count ?? 0);
    }
    if (productType === "mock_test") {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from mock_tests mt
        join assessments a on a.id = mt.assessment_id and a.tenant_id = mt.tenant_id
        where mt.tenant_id = current_setting('app.tenant_id', true)::uuid
          and mt.id = ${productId}::uuid
          and mt.deleted_at is null
          and a.deleted_at is null
          and (
            ${q ?? null}::text is null
            or lower(a.title) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return Number(rows[0]?.count ?? 0);
    }
    if (productType === "test_series") {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(distinct a.id)::bigint as count
        from test_series_items tsi
        join assessments a on a.id = coalesce(
          tsi.assessment_id,
          (select mt.assessment_id from mock_tests mt where mt.id = tsi.mock_test_id and mt.deleted_at is null)
        ) and a.tenant_id = tsi.tenant_id
        where tsi.tenant_id = current_setting('app.tenant_id', true)::uuid
          and tsi.test_series_id = ${productId}::uuid
          and a.deleted_at is null
          and (
            ${q ?? null}::text is null
            or lower(a.title) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return Number(rows[0]?.count ?? 0);
    }
    if (productType === "bundle") {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
        with bundle_assessments as (
          select distinct a.id
          from bundle_items bi
          join assessments a on a.tenant_id = bi.tenant_id and a.deleted_at is null
          left join lessons l on bi.item_kind = 'course'
            and l.deleted_at is null
            and l.tenant_id = bi.tenant_id
            and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
          left join course_modules cm on bi.item_kind = 'course'
            and cm.id = l.module_id
            and cm.tenant_id = l.tenant_id
            and cm.deleted_at is null
            and cm.course_id = bi.ref_id
          left join mock_tests mt on bi.item_kind = 'mock_test'
            and mt.id = bi.ref_id
            and mt.deleted_at is null
            and mt.assessment_id = a.id
          left join test_series_items tsi on bi.item_kind = 'test_series'
            and tsi.test_series_id = bi.ref_id
            and tsi.tenant_id = bi.tenant_id
            and a.id = coalesce(
              tsi.assessment_id,
              (select mt2.assessment_id from mock_tests mt2 where mt2.id = tsi.mock_test_id and mt2.deleted_at is null)
            )
          where bi.bundle_id = ${productId}::uuid
            and bi.tenant_id = current_setting('app.tenant_id', true)::uuid
            and (
              (bi.item_kind = 'course' and cm.id is not null)
              or (bi.item_kind = 'mock_test' and mt.id is not null)
              or (bi.item_kind = 'test_series' and tsi.id is not null)
            )
        )
        select count(*)::bigint as count
        from bundle_assessments ba
        join assessments a on a.id = ba.id
        where (
          ${q ?? null}::text is null
          or lower(a.title) like '%' || lower(${q ?? null}) || '%'
        )
      `;
      return Number(rows[0]?.count ?? 0);
    }
    return 0;
  },

  async listQuizzes(
    tx: TenantTx,
    courseId: string,
    query: ScoreQuizzesQuery,
  ): Promise<ScoreQuizRow[]> {
    return this.listProductQuizzes(tx, "course", courseId, query);
  },

  async listProductQuizzes(
    tx: TenantTx,
    productType: ScoreProductType,
    productId: string,
    query: ScoreQuizzesQuery,
  ): Promise<ScoreQuizRow[]> {
    const skip = (query.page - 1) * query.limit;
    if (productType === "course") {
      return tx.$queryRaw<ScoreQuizRow[]>`
        select
          a.id::text as assessment_id,
          a.title,
          a.assessment_type,
          min(l.id::text) as lesson_id,
          min(l.title) as lesson_title,
          coalesce(stats.attempt_count, 0)::int as attempt_count,
          coalesce(stats.learner_count, 0)::int as learner_count
        from assessments a
        join lessons l on l.tenant_id = a.tenant_id
          and l.deleted_at is null
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        left join lateral (
          select
            count(*)::int as attempt_count,
            count(distinct membership_id)::int as learner_count
          from attempts at
          where at.assessment_id = a.id
            and at.tenant_id = a.tenant_id
        ) stats on true
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
          and cm.course_id = ${productId}::uuid
          and (
            ${query.q ?? null}::text is null
            or lower(a.title) like '%' || lower(${query.q ?? null}) || '%'
          )
        group by a.id, a.title, a.assessment_type, stats.attempt_count, stats.learner_count
        order by a.title asc
        limit ${query.limit}
        offset ${skip}
      `;
    }
    if (productType === "mock_test") {
      return tx.$queryRaw<ScoreQuizRow[]>`
        select
          a.id::text as assessment_id,
          a.title,
          a.assessment_type,
          null::text as lesson_id,
          mt.title as lesson_title,
          coalesce(stats.attempt_count, 0)::int as attempt_count,
          coalesce(stats.learner_count, 0)::int as learner_count
        from mock_tests mt
        join assessments a on a.id = mt.assessment_id and a.tenant_id = mt.tenant_id
        left join lateral (
          select
            count(*)::int as attempt_count,
            count(distinct membership_id)::int as learner_count
          from attempts at
          where at.assessment_id = a.id
            and at.tenant_id = a.tenant_id
        ) stats on true
        where mt.tenant_id = current_setting('app.tenant_id', true)::uuid
          and mt.id = ${productId}::uuid
          and mt.deleted_at is null
          and a.deleted_at is null
          and (
            ${query.q ?? null}::text is null
            or lower(a.title) like '%' || lower(${query.q ?? null}) || '%'
          )
        order by a.title asc
        limit ${query.limit}
        offset ${skip}
      `;
    }
    if (productType === "test_series") {
      return tx.$queryRaw<ScoreQuizRow[]>`
        select
          a.id::text as assessment_id,
          a.title,
          a.assessment_type,
          null::text as lesson_id,
          coalesce(tsi.title, a.title) as lesson_title,
          coalesce(stats.attempt_count, 0)::int as attempt_count,
          coalesce(stats.learner_count, 0)::int as learner_count
        from test_series_items tsi
        join assessments a on a.id = coalesce(
          tsi.assessment_id,
          (select mt.assessment_id from mock_tests mt where mt.id = tsi.mock_test_id and mt.deleted_at is null)
        ) and a.tenant_id = tsi.tenant_id
        left join lateral (
          select
            count(*)::int as attempt_count,
            count(distinct membership_id)::int as learner_count
          from attempts at
          where at.assessment_id = a.id
            and at.tenant_id = a.tenant_id
        ) stats on true
        where tsi.tenant_id = current_setting('app.tenant_id', true)::uuid
          and tsi.test_series_id = ${productId}::uuid
          and a.deleted_at is null
          and (
            ${query.q ?? null}::text is null
            or lower(a.title) like '%' || lower(${query.q ?? null}) || '%'
          )
        group by a.id, a.title, a.assessment_type, tsi.title, stats.attempt_count, stats.learner_count
        order by a.title asc
        limit ${query.limit}
        offset ${skip}
      `;
    }
    if (productType === "bundle") {
      return tx.$queryRaw<ScoreQuizRow[]>`
        with bundle_assessments as (
          select distinct on (a.id)
            a.id as assessment_id,
            a.title,
            a.assessment_type,
            case when bi.item_kind = 'course' then l.id::text else null end as lesson_id,
            coalesce(l.title, mt.title, tsi.title, a.title) as lesson_title
          from bundle_items bi
          join assessments a on a.tenant_id = bi.tenant_id and a.deleted_at is null
          left join lessons l on bi.item_kind = 'course'
            and l.deleted_at is null
            and l.tenant_id = bi.tenant_id
            and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
          left join course_modules cm on bi.item_kind = 'course'
            and cm.id = l.module_id
            and cm.tenant_id = l.tenant_id
            and cm.deleted_at is null
            and cm.course_id = bi.ref_id
          left join mock_tests mt on bi.item_kind = 'mock_test'
            and mt.id = bi.ref_id
            and mt.deleted_at is null
            and mt.assessment_id = a.id
          left join test_series_items tsi on bi.item_kind = 'test_series'
            and tsi.test_series_id = bi.ref_id
            and tsi.tenant_id = bi.tenant_id
            and a.id = coalesce(
              tsi.assessment_id,
              (select mt2.assessment_id from mock_tests mt2 where mt2.id = tsi.mock_test_id and mt2.deleted_at is null)
            )
          where bi.bundle_id = ${productId}::uuid
            and bi.tenant_id = current_setting('app.tenant_id', true)::uuid
            and (
              (bi.item_kind = 'course' and cm.id is not null)
              or (bi.item_kind = 'mock_test' and mt.id is not null)
              or (bi.item_kind = 'test_series' and tsi.id is not null)
            )
          order by a.id, bi.position asc
        )
        select
          ba.assessment_id::text as assessment_id,
          ba.title,
          ba.assessment_type,
          ba.lesson_id,
          ba.lesson_title,
          coalesce(stats.attempt_count, 0)::int as attempt_count,
          coalesce(stats.learner_count, 0)::int as learner_count
        from bundle_assessments ba
        join assessments a on a.id = ba.assessment_id
        left join lateral (
          select
            count(*)::int as attempt_count,
            count(distinct membership_id)::int as learner_count
          from attempts at
          where at.assessment_id = ba.assessment_id
            and at.tenant_id = a.tenant_id
        ) stats on true
        where (
          ${query.q ?? null}::text is null
          or lower(ba.title) like '%' || lower(${query.q ?? null}) || '%'
        )
        order by ba.title asc
        limit ${query.limit}
        offset ${skip}
      `;
    }
    return [];
  },

  async countScoreLearners(tx: TenantTx, filter: ScoreLearnersFilter): Promise<number> {
    const view = filter.view ?? "all";
    const attemptsFilter = filter.attemptsFilter ?? null;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with question_count as (
        select count(*)::int as n
        from assessment_items ai
        where ai.assessment_id = ${filter.assessmentId}::uuid
          and ai.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      learner_attempts as (
        select
          at.membership_id,
          count(*) filter (where at.status::text <> 'VOIDED')::int as attempt_count,
          max(at.score_pct) filter (where at.score_pct is not null) as best_score_pct,
          (
            select at_first.score_pct
            from attempts at_first
            where at_first.membership_id = at.membership_id
              and at_first.assessment_id = at.assessment_id
              and at_first.tenant_id = at.tenant_id
              and at_first.status::text <> 'VOIDED'
              and at_first.score_pct is not null
            order by at_first.started_at asc
            limit 1
          ) as first_score_pct
        from attempts at
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.assessment_id = ${filter.assessmentId}::uuid
        group by at.membership_id, at.assessment_id, at.tenant_id
      ),
      latest as (
        select distinct on (at.membership_id)
          at.membership_id,
          at.id as latest_attempt_id,
          at.status::text as attempt_status,
          at.score_pct,
          at.submitted_at,
          at.started_at,
          la.attempt_count,
          la.best_score_pct,
          la.first_score_pct
        from attempts at
        join learner_attempts la on la.membership_id = at.membership_id
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.assessment_id = ${filter.assessmentId}::uuid
          and at.status::text <> 'VOIDED'
        order by at.membership_id, coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      ),
      scored as (
        select
          lt.*,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          case
            when lt.attempt_status in ('STARTED') then 'in_progress'
            when lt.score_pct is null then 'pending'
            when nullif(a.config_json->>'passMarkPercent', '')::float is not null
              and lt.score_pct >= nullif(a.config_json->>'passMarkPercent', '')::float then 'pass'
            when nullif(a.config_json->>'passMarkPercent', '')::float is not null then 'fail'
            else 'pending'
          end as result_status,
          (
            lt.attempt_count > 1
            and lt.best_score_pct is not null
            and lt.first_score_pct is not null
            and lt.best_score_pct > lt.first_score_pct
          ) as improved_on_retry
        from latest lt
        join assessments a on a.id = ${filter.assessmentId}::uuid
        join memberships m on m.id = lt.membership_id and m.tenant_id = current_setting('app.tenant_id', true)::uuid
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
      )
      select count(*)::bigint as count
      from scored
      where (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(learner_name, '')) like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (${filter.resultStatus ?? null}::text is null or result_status = ${filter.resultStatus ?? null})
        and (${filter.minScore ?? null}::float is null or score_pct >= ${filter.minScore ?? null}::float)
        and (${filter.maxScore ?? null}::float is null or score_pct <= ${filter.maxScore ?? null}::float)
        and (${filter.minAttempts ?? null}::int is null or attempt_count >= ${filter.minAttempts ?? null}::int)
        and (
          ${attemptsFilter}::text is null
          or (${attemptsFilter}::text = 'first_only' and attempt_count = 1)
          or (${attemptsFilter}::text = 'more_than_one' and attempt_count > 1)
          or ${attemptsFilter}::text = 'any'
        )
        and (
          ${view}::text = 'all'
          or (${view}::text = 'failed' and result_status = 'fail')
          or (${view}::text = 'ungraded' and result_status = 'pending')
          or (${view}::text = 'improved_on_retry' and improved_on_retry)
        )
        and (
          ${filter.submittedFrom ?? null}::timestamptz is null
          or submitted_at >= ${filter.submittedFrom ?? null}::timestamptz
        )
        and (
          ${filter.submittedTo ?? null}::timestamptz is null
          or submitted_at <= ${filter.submittedTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listScoreLearners(
    tx: TenantTx,
    assessmentId: string,
    query: ScoreLearnersQuery,
  ): Promise<ScoreLearnerRow[]> {
    const skip = (query.page - 1) * query.limit;
    const view = query.view ?? "all";
    const attemptsFilter = query.attemptsFilter ?? null;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with question_count as (
        select count(*)::int as n
        from assessment_items ai
        where ai.assessment_id = ${assessmentId}::uuid
          and ai.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      learner_attempts as (
        select
          at.membership_id,
          count(*) filter (where at.status::text <> 'VOIDED')::int as attempt_count,
          max(at.score_pct) filter (where at.score_pct is not null) as best_score_pct,
          (
            select at_first.score_pct
            from attempts at_first
            where at_first.membership_id = at.membership_id
              and at_first.assessment_id = at.assessment_id
              and at_first.tenant_id = at.tenant_id
              and at_first.status::text <> 'VOIDED'
              and at_first.score_pct is not null
            order by at_first.started_at asc
            limit 1
          ) as first_score_pct
        from attempts at
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.assessment_id = ${assessmentId}::uuid
        group by at.membership_id, at.assessment_id, at.tenant_id
      ),
      latest as (
        select distinct on (at.membership_id)
          at.membership_id,
          at.id as latest_attempt_id,
          at.status::text as attempt_status,
          at.score_pct,
          at.submitted_at,
          at.started_at,
          la.attempt_count,
          la.best_score_pct,
          la.first_score_pct,
          (
            select count(*)::int
            from attempt_answers aa
            where aa.attempt_id = at.id
              and aa.tenant_id = at.tenant_id
          ) as answered_count,
          case
            when at.submitted_at is not null
              then extract(epoch from (at.submitted_at - at.started_at))
            else null
          end as duration_seconds
        from attempts at
        join learner_attempts la on la.membership_id = at.membership_id
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.assessment_id = ${assessmentId}::uuid
          and at.status::text <> 'VOIDED'
        order by at.membership_id, coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      ),
      scored as (
        select
          lt.membership_id,
          ${assessmentId}::uuid as assessment_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          case
            when lt.attempt_status in ('STARTED') then 'in_progress'
            when lt.score_pct is null then 'pending'
            when nullif(a.config_json->>'passMarkPercent', '')::float is not null
              and lt.score_pct >= nullif(a.config_json->>'passMarkPercent', '')::float then 'pass'
            when nullif(a.config_json->>'passMarkPercent', '')::float is not null then 'fail'
            else 'pending'
          end as result_status,
          lt.attempt_count,
          lt.score_pct,
          lt.best_score_pct,
          lt.answered_count,
          (select n from question_count) as question_count,
          lt.duration_seconds,
          lt.submitted_at,
          lt.started_at,
          lt.latest_attempt_id,
          (
            lt.attempt_count > 1
            and lt.best_score_pct is not null
            and lt.first_score_pct is not null
            and lt.best_score_pct > lt.first_score_pct
          ) as improved_on_retry
        from latest lt
        join assessments a on a.id = ${assessmentId}::uuid
        join memberships m on m.id = lt.membership_id and m.tenant_id = current_setting('app.tenant_id', true)::uuid
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
      )
      select
        membership_id::text,
        assessment_id::text,
        learner_name,
        email,
        result_status,
        attempt_count,
        score_pct,
        best_score_pct,
        answered_count,
        question_count,
        duration_seconds,
        submitted_at,
        started_at,
        latest_attempt_id::text,
        improved_on_retry
      from scored
      where (
          ${query.learnerName ?? null}::text is null
          or lower(coalesce(learner_name, '')) like '%' || lower(${query.learnerName ?? null}) || '%'
        )
        and (${query.resultStatus ?? null}::text is null or result_status = ${query.resultStatus ?? null})
        and (${query.minScore ?? null}::float is null or score_pct >= ${query.minScore ?? null}::float)
        and (${query.maxScore ?? null}::float is null or score_pct <= ${query.maxScore ?? null}::float)
        and (${query.minAttempts ?? null}::int is null or attempt_count >= ${query.minAttempts ?? null}::int)
        and (
          ${attemptsFilter}::text is null
          or (${attemptsFilter}::text = 'first_only' and attempt_count = 1)
          or (${attemptsFilter}::text = 'more_than_one' and attempt_count > 1)
          or ${attemptsFilter}::text = 'any'
        )
        and (
          ${view}::text = 'all'
          or (${view}::text = 'failed' and result_status = 'fail')
          or (${view}::text = 'ungraded' and result_status = 'pending')
          or (${view}::text = 'improved_on_retry' and improved_on_retry)
        )
        and (
          ${query.submittedFrom ?? null}::timestamptz is null
          or submitted_at >= ${query.submittedFrom ?? null}::timestamptz
        )
        and (
          ${query.submittedTo ?? null}::timestamptz is null
          or submitted_at <= ${query.submittedTo ?? null}::timestamptz
        )
      order by
        case when ${query.sortBy} = 'score_pct' and ${query.sortDir} = 'asc' then score_pct end asc nulls last,
        case when ${query.sortBy} = 'score_pct' and ${query.sortDir} = 'desc' then score_pct end desc nulls last,
        case when ${query.sortBy} = 'attempt_count' and ${query.sortDir} = 'asc' then attempt_count end asc,
        case when ${query.sortBy} = 'attempt_count' and ${query.sortDir} = 'desc' then attempt_count end desc,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then learner_name end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then learner_name end desc nulls last,
        case when ${query.sortBy} = 'submitted_at' and ${query.sortDir} = 'asc' then submitted_at end asc nulls last,
        case when ${query.sortBy} = 'submitted_at' and ${query.sortDir} = 'desc' then submitted_at end desc nulls last,
        membership_id desc
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map((row) => ({
      membership_id: String(row["membership_id"]),
      assessment_id: String(row["assessment_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      result_status: String(row["result_status"]) as ScoreLearnerRow["result_status"],
      attempt_count: Number(row["attempt_count"] ?? 0),
      score_pct: row["score_pct"] == null ? null : Number(row["score_pct"]),
      best_score_pct: row["best_score_pct"] == null ? null : Number(row["best_score_pct"]),
      answered_count: Number(row["answered_count"] ?? 0),
      question_count: row["question_count"] == null ? null : Number(row["question_count"]),
      duration_seconds:
        row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
      submitted_at: row["submitted_at"] instanceof Date ? row["submitted_at"] : null,
      started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
      latest_attempt_id:
        typeof row["latest_attempt_id"] === "string" ? row["latest_attempt_id"] : null,
      improved_on_retry: Boolean(row["improved_on_retry"]),
    }));
  },

  async listScoreMembershipIds(tx: TenantTx, filter: ScoreLearnersFilter): Promise<string[]> {
    const all = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select distinct at.membership_id::text as membership_id
      from attempts at
      join memberships m on m.id = at.membership_id and m.tenant_id = at.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where at.tenant_id = current_setting('app.tenant_id', true)::uuid
        and at.assessment_id = ${filter.assessmentId}::uuid
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.submittedFrom ?? null}::timestamptz is null
          or at.submitted_at >= ${filter.submittedFrom ?? null}::timestamptz
        )
        and (
          ${filter.submittedTo ?? null}::timestamptz is null
          or at.submitted_at <= ${filter.submittedTo ?? null}::timestamptz
        )
      order by membership_id
      limit 2000
    `;
    return all.map((row) => row.membership_id);
  },

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

    const scoredCount = Number(scores?.scored_count ?? 0);
    const passCount = Number(scores?.pass_count ?? 0);

    return {
      averageCompletionPct:
        completion?.avg_completion_pct == null
          ? null
          : Math.round(Number(completion.avg_completion_pct) * 10) / 10,
      previousAverageCompletionPct:
        previous?.avg_completion_pct == null
          ? null
          : Math.round(Number(previous.avg_completion_pct) * 10) / 10,
      activeEnrolmentCount: Number(completion?.active_count ?? 0),
      learnersAtRiskCount: Number(activity?.at_risk_count ?? 0),
      assessmentPassRatePct:
        scoredCount > 0 ? Math.round((passCount / scoredCount) * 1000) / 10 : null,
      assessmentAttemptCount: Number(scores?.attempt_count ?? 0),
      awaitingGradingCount: Number(grading?.awaiting_count ?? 0),
      enrolmentActivityCount: Number(activity?.activity_count ?? 0),
      completionBands: {
        not_started: Number(bands?.not_started ?? 0),
        early: Number(bands?.early ?? 0),
        in_progress: Number(bands?.in_progress ?? 0),
        nearly_done: Number(bands?.nearly_done ?? 0),
        complete: Number(bands?.complete ?? 0),
      },
    };
  },
};

