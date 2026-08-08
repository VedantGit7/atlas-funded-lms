import type { TenantTx } from "@atlas/db";
import type {
  ProductPublishStatus,
  ScoreProductType,
  ScoreQuizzesQuery,
} from "./progress-score-roster.dto";

export type ScoreAssessmentRow = {
  assessment_id: string;
  title: string;
  assessment_type: string;
  lesson_id: string | null;
  lesson_title: string | null;
  question_count: number | null;
  pass_mark_pct: number | null;
  attempt_count: number;
  learner_count: number;
  avg_score_pct: number | null;
  pass_rate_pct: number | null;
  ungraded_count: number;
  last_attempt_at: Date | null;
  spread_min: number | null;
  spread_q1: number | null;
  spread_median: number | null;
  spread_q3: number | null;
  spread_max: number | null;
};

export type ScoreAssessmentProductMeta = {
  product_id: string;
  title: string;
  slug: string | null;
  status: ProductPublishStatus | null;
};

export type ScoreAssessmentSummaryRow = {
  assessment_count: number;
  learners_attempted: number;
  attempt_count: number;
  avg_score_pct: number | null;
  pass_rate_pct: number | null;
  ungraded_count: number;
  median_duration_seconds: number | null;
};

function passRateBandSql(band: ScoreQuizzesQuery["passRateBand"]): string | null {
  return band ?? null;
}

function mapAssessmentRow(row: Record<string, unknown>): ScoreAssessmentRow {
  const num = (key: string): number | null => {
    const value = row[key];
    if (value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  return {
    assessment_id: String(row["assessment_id"]),
    title: String(row["title"] ?? ""),
    assessment_type: String(row["assessment_type"] ?? ""),
    lesson_id: row["lesson_id"] == null ? null : String(row["lesson_id"]),
    lesson_title: row["lesson_title"] == null ? null : String(row["lesson_title"]),
    question_count: num("question_count"),
    pass_mark_pct: num("pass_mark_pct"),
    attempt_count: Number(row["attempt_count"] ?? 0),
    learner_count: Number(row["learner_count"] ?? 0),
    avg_score_pct: num("avg_score_pct"),
    pass_rate_pct: num("pass_rate_pct"),
    ungraded_count: Number(row["ungraded_count"] ?? 0),
    last_attempt_at:
      row["last_attempt_at"] instanceof Date
        ? row["last_attempt_at"]
        : row["last_attempt_at"]
          ? new Date(String(row["last_attempt_at"]))
          : null,
    spread_min: num("spread_min"),
    spread_q1: num("spread_q1"),
    spread_median: num("spread_median"),
    spread_q3: num("spread_q3"),
    spread_max: num("spread_max"),
  };
}

export const progressScoreAssessmentsRepository = {
  async findProductMeta(
    tx: TenantTx,
    productType: ScoreProductType,
    productId: string,
  ): Promise<ScoreAssessmentProductMeta | null> {
    if (productType === "course") {
      const rows = await tx.$queryRaw<ScoreAssessmentProductMeta[]>`
        select id::text as product_id, title, slug, status::text as status
        from courses
        where id = ${productId}::uuid and deleted_at is null
        limit 1
      `;
      return rows[0] ?? null;
    }
    if (productType === "test_series") {
      const rows = await tx.$queryRaw<ScoreAssessmentProductMeta[]>`
        select id::text as product_id, title, slug, status::text as status
        from test_series
        where id = ${productId}::uuid and deleted_at is null
        limit 1
      `;
      return rows[0] ?? null;
    }
    if (productType === "bundle") {
      const rows = await tx.$queryRaw<ScoreAssessmentProductMeta[]>`
        select id::text as product_id, title, slug, status::text as status
        from bundles
        where id = ${productId}::uuid and deleted_at is null
        limit 1
      `;
      return rows[0] ?? null;
    }
    if (productType === "mock_test") {
      const rows = await tx.$queryRaw<ScoreAssessmentProductMeta[]>`
        select id::text as product_id, title, slug, status::text as status
        from mock_tests
        where id = ${productId}::uuid and deleted_at is null
        limit 1
      `;
      return rows[0] ?? null;
    }
    return null;
  },

  async getProductSummary(
    tx: TenantTx,
    productType: ScoreProductType,
    productId: string,
  ): Promise<ScoreAssessmentSummaryRow> {
    const empty: ScoreAssessmentSummaryRow = {
      assessment_count: 0,
      learners_attempted: 0,
      attempt_count: 0,
      avg_score_pct: null,
      pass_rate_pct: null,
      ungraded_count: 0,
      median_duration_seconds: null,
    };

    if (productType === "course") {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        with course_assessments as (
          select
            a.id as assessment_id,
            nullif(a.config_json->>'passMarkPercent', '')::float as pass_mark
          from assessments a
          join lessons l on l.tenant_id = a.tenant_id
            and l.deleted_at is null
            and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
          join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
          where a.tenant_id = current_setting('app.tenant_id', true)::uuid
            and a.deleted_at is null
            and cm.course_id = ${productId}::uuid
          group by a.id, a.config_json
        ),
        latest as (
          select distinct on (ca.assessment_id, at.membership_id)
            ca.assessment_id,
            at.membership_id,
            at.score_pct,
            ca.pass_mark,
            case
              when at.submitted_at is not null
                then extract(epoch from (at.submitted_at - at.started_at))
              else null
            end as duration_sec
          from course_assessments ca
          join attempts at
            on at.assessment_id = ca.assessment_id
            and at.tenant_id = current_setting('app.tenant_id', true)::uuid
            and at.status::text <> 'VOIDED'
          order by ca.assessment_id, at.membership_id,
            coalesce(at.submitted_at, at.graded_at, at.started_at) desc
        )
        select
          (select count(*)::int from course_assessments) as assessment_count,
          (select count(distinct membership_id)::int from latest) as learners_attempted,
          (
            select count(*)::int
            from attempts at
            join course_assessments ca on ca.assessment_id = at.assessment_id
            where at.tenant_id = current_setting('app.tenant_id', true)::uuid
              and at.status::text <> 'VOIDED'
          ) as attempt_count,
          (select avg(score_pct)::float from latest where score_pct is not null) as avg_score_pct,
          (
            select
              case
                when count(*) filter (where score_pct is not null and pass_mark is not null) = 0 then null
                else (
                  count(*) filter (
                    where score_pct is not null and pass_mark is not null and score_pct >= pass_mark
                  )::numeric
                  / count(*) filter (where score_pct is not null and pass_mark is not null)::numeric
                ) * 100
              end
            from latest
          )::float as pass_rate_pct,
          (
            select count(*)::int
            from attempts at
            join course_assessments ca on ca.assessment_id = at.assessment_id
            where at.tenant_id = current_setting('app.tenant_id', true)::uuid
              and at.status::text = 'SUBMITTED'
              and at.score_pct is null
          ) as ungraded_count,
          (
            select percentile_cont(0.5) within group (order by duration_sec)::float
            from latest
            where duration_sec is not null and duration_sec >= 0
          ) as median_duration_seconds
      `;
      const row = rows[0];
      if (!row) return empty;
      return {
        assessment_count: Number(row["assessment_count"] ?? 0),
        learners_attempted: Number(row["learners_attempted"] ?? 0),
        attempt_count: Number(row["attempt_count"] ?? 0),
        avg_score_pct:
          row["avg_score_pct"] == null ? null : Number(row["avg_score_pct"]),
        pass_rate_pct:
          row["pass_rate_pct"] == null ? null : Number(row["pass_rate_pct"]),
        ungraded_count: Number(row["ungraded_count"] ?? 0),
        median_duration_seconds:
          row["median_duration_seconds"] == null
            ? null
            : Number(row["median_duration_seconds"]),
      };
    }

    // Non-course products: reuse list + aggregate lightly via assessment set
    const assessmentIds = await this.listAssessmentIds(tx, productType, productId);
    if (assessmentIds.length === 0) return empty;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with ids as (
        select unnest(${assessmentIds}::uuid[]) as assessment_id
      ),
      marked as (
        select
          a.id as assessment_id,
          nullif(a.config_json->>'passMarkPercent', '')::float as pass_mark
        from assessments a
        join ids i on i.assessment_id = a.id
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
      ),
      latest as (
        select distinct on (m.assessment_id, at.membership_id)
          m.assessment_id,
          at.membership_id,
          at.score_pct,
          m.pass_mark,
          case
            when at.submitted_at is not null
              then extract(epoch from (at.submitted_at - at.started_at))
            else null
          end as duration_sec
        from marked m
        join attempts at
          on at.assessment_id = m.assessment_id
          and at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.status::text <> 'VOIDED'
        order by m.assessment_id, at.membership_id,
          coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      )
      select
        (select count(*)::int from marked) as assessment_count,
        (select count(distinct membership_id)::int from latest) as learners_attempted,
        (
          select count(*)::int
          from attempts at
          join marked m on m.assessment_id = at.assessment_id
          where at.tenant_id = current_setting('app.tenant_id', true)::uuid
            and at.status::text <> 'VOIDED'
        ) as attempt_count,
        (select avg(score_pct)::float from latest where score_pct is not null) as avg_score_pct,
        (
          select
            case
              when count(*) filter (where score_pct is not null and pass_mark is not null) = 0 then null
              else (
                count(*) filter (
                  where score_pct is not null and pass_mark is not null and score_pct >= pass_mark
                )::numeric
                / count(*) filter (where score_pct is not null and pass_mark is not null)::numeric
              ) * 100
            end
          from latest
        )::float as pass_rate_pct,
        (
          select count(*)::int
          from attempts at
          join marked m on m.assessment_id = at.assessment_id
          where at.tenant_id = current_setting('app.tenant_id', true)::uuid
            and at.status::text = 'SUBMITTED'
            and at.score_pct is null
        ) as ungraded_count,
        (
          select percentile_cont(0.5) within group (order by duration_sec)::float
          from latest
          where duration_sec is not null and duration_sec >= 0
        ) as median_duration_seconds
    `;
    const row = rows[0];
    if (!row) return empty;
    return {
      assessment_count: Number(row["assessment_count"] ?? 0),
      learners_attempted: Number(row["learners_attempted"] ?? 0),
      attempt_count: Number(row["attempt_count"] ?? 0),
      avg_score_pct: row["avg_score_pct"] == null ? null : Number(row["avg_score_pct"]),
      pass_rate_pct: row["pass_rate_pct"] == null ? null : Number(row["pass_rate_pct"]),
      ungraded_count: Number(row["ungraded_count"] ?? 0),
      median_duration_seconds:
        row["median_duration_seconds"] == null
          ? null
          : Number(row["median_duration_seconds"]),
    };
  },

  async listAssessmentIds(
    tx: TenantTx,
    productType: ScoreProductType,
    productId: string,
  ): Promise<string[]> {
    if (productType === "course") {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        select distinct a.id::text as id
        from assessments a
        join lessons l on l.tenant_id = a.tenant_id
          and l.deleted_at is null
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
          and cm.course_id = ${productId}::uuid
      `;
      return rows.map((r) => r.id);
    }
    if (productType === "mock_test") {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        select a.id::text as id
        from mock_tests mt
        join assessments a on a.id = mt.assessment_id and a.tenant_id = mt.tenant_id
        where mt.tenant_id = current_setting('app.tenant_id', true)::uuid
          and mt.id = ${productId}::uuid
          and mt.deleted_at is null
          and a.deleted_at is null
      `;
      return rows.map((r) => r.id);
    }
    if (productType === "test_series") {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        select distinct a.id::text as id
        from test_series_items tsi
        join assessments a on a.id = coalesce(
          tsi.assessment_id,
          (select mt.assessment_id from mock_tests mt where mt.id = tsi.mock_test_id and mt.deleted_at is null)
        ) and a.tenant_id = tsi.tenant_id
        where tsi.tenant_id = current_setting('app.tenant_id', true)::uuid
          and tsi.test_series_id = ${productId}::uuid
          and a.deleted_at is null
      `;
      return rows.map((r) => r.id);
    }
    if (productType === "bundle") {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        select distinct a.id::text as id
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
      `;
      return rows.map((r) => r.id);
    }
    return [];
  },

  async countAssessments(
    tx: TenantTx,
    productType: ScoreProductType,
    productId: string,
    query: ScoreQuizzesQuery,
  ): Promise<number> {
    const rows = await this.queryAssessments(tx, productType, productId, query, true);
    return Number(rows[0]?.["count"] ?? 0);
  },

  async listAssessments(
    tx: TenantTx,
    productType: ScoreProductType,
    productId: string,
    query: ScoreQuizzesQuery,
  ): Promise<ScoreAssessmentRow[]> {
    const rows = await this.queryAssessments(tx, productType, productId, query, false);
    return rows.map(mapAssessmentRow);
  },

  async queryAssessments(
    tx: TenantTx,
    productType: ScoreProductType,
    productId: string,
    query: ScoreQuizzesQuery,
    countOnly: boolean,
  ): Promise<Array<Record<string, unknown>>> {
    const skip = (query.page - 1) * query.limit;
    const q = query.q ?? null;
    const assessmentType = query.assessmentType ?? null;
    const lessonId = query.lessonId ?? null;
    const passRateBand = passRateBandSql(query.passRateBand);
    const hasUngraded = query.hasUngraded === true;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;

    // Prisma tagged templates need real interpolations — build per product type.
    if (productType === "course") {
      if (countOnly) {
        return tx.$queryRaw<Array<Record<string, unknown>>>`
          with base as (
            select
              a.id as assessment_id,
              a.title,
              a.assessment_type,
              min(l.id::text) as lesson_id,
              min(l.title) as lesson_title,
              nullif(a.config_json->>'passMarkPercent', '')::float as pass_mark
            from assessments a
            join lessons l on l.tenant_id = a.tenant_id
              and l.deleted_at is null
              and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
            join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
            where a.tenant_id = current_setting('app.tenant_id', true)::uuid
              and a.deleted_at is null
              and cm.course_id = ${productId}::uuid
              and (${assessmentType}::text is null or a.assessment_type = ${assessmentType})
              and (${lessonId}::uuid is null or l.id = ${lessonId}::uuid)
              and (
                ${q}::text is null
                or lower(a.title) like '%' || lower(${q}) || '%'
              )
            group by a.id, a.title, a.assessment_type, a.config_json
          ),
          latest as (
            select distinct on (b.assessment_id, at.membership_id)
              b.assessment_id,
              at.membership_id,
              at.score_pct,
              b.pass_mark
            from base b
            join attempts at
              on at.assessment_id = b.assessment_id
              and at.tenant_id = current_setting('app.tenant_id', true)::uuid
              and at.status::text <> 'VOIDED'
            order by b.assessment_id, at.membership_id,
              coalesce(at.submitted_at, at.graded_at, at.started_at) desc
          ),
          metrics as (
            select
              b.assessment_id::text as assessment_id,
              (
                select
                  case
                    when count(*) filter (where lt.score_pct is not null and lt.pass_mark is not null) = 0
                      then null
                    else (
                      count(*) filter (
                        where lt.score_pct is not null
                          and lt.pass_mark is not null
                          and lt.score_pct >= lt.pass_mark
                      )::numeric
                      / count(*) filter (
                        where lt.score_pct is not null and lt.pass_mark is not null
                      )::numeric
                    ) * 100
                  end
                from latest lt
                where lt.assessment_id = b.assessment_id
              )::float as pass_rate_pct,
              (
                select count(*)::int
                from attempts at
                where at.assessment_id = b.assessment_id
                  and at.tenant_id = current_setting('app.tenant_id', true)::uuid
                  and at.status::text = 'SUBMITTED'
                  and at.score_pct is null
              ) as ungraded_count
            from base b
          )
          select count(*)::bigint as count
          from metrics m
          where (
            ${passRateBand}::text is null
            or (${passRateBand}::text = 'below_50' and m.pass_rate_pct is not null and m.pass_rate_pct < 50)
            or (${passRateBand}::text = 'mid_50_75' and m.pass_rate_pct is not null and m.pass_rate_pct >= 50 and m.pass_rate_pct <= 75)
            or (${passRateBand}::text = 'above_75' and m.pass_rate_pct is not null and m.pass_rate_pct > 75)
          )
          and (${hasUngraded}::boolean = false or m.ungraded_count > 0)
        `;
      }

      return tx.$queryRaw<Array<Record<string, unknown>>>`
        with base as (
          select
            a.id as assessment_id,
            a.title,
            a.assessment_type,
            min(l.id::text) as lesson_id,
            min(l.title) as lesson_title,
            nullif(a.config_json->>'passMarkPercent', '')::float as pass_mark
          from assessments a
          join lessons l on l.tenant_id = a.tenant_id
            and l.deleted_at is null
            and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
          join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
          where a.tenant_id = current_setting('app.tenant_id', true)::uuid
            and a.deleted_at is null
            and cm.course_id = ${productId}::uuid
            and (${assessmentType}::text is null or a.assessment_type = ${assessmentType})
            and (${lessonId}::uuid is null or l.id = ${lessonId}::uuid)
            and (
              ${q}::text is null
              or lower(a.title) like '%' || lower(${q}) || '%'
            )
          group by a.id, a.title, a.assessment_type, a.config_json
        ),
        latest as (
          select distinct on (b.assessment_id, at.membership_id)
            b.assessment_id,
            at.membership_id,
            at.score_pct,
            b.pass_mark
          from base b
          join attempts at
            on at.assessment_id = b.assessment_id
            and at.tenant_id = current_setting('app.tenant_id', true)::uuid
            and at.status::text <> 'VOIDED'
          order by b.assessment_id, at.membership_id,
            coalesce(at.submitted_at, at.graded_at, at.started_at) desc
        ),
        metrics as (
          select
            b.assessment_id::text as assessment_id,
            b.title,
            b.assessment_type,
            b.lesson_id,
            b.lesson_title,
            (
              select count(*)::int
              from assessment_items ai
              where ai.assessment_id = b.assessment_id
                and ai.tenant_id = current_setting('app.tenant_id', true)::uuid
            ) as question_count,
            b.pass_mark as pass_mark_pct,
            (
              select count(*)::int
              from attempts at
              where at.assessment_id = b.assessment_id
                and at.tenant_id = current_setting('app.tenant_id', true)::uuid
                and at.status::text <> 'VOIDED'
            ) as attempt_count,
            (
              select count(distinct at.membership_id)::int
              from attempts at
              where at.assessment_id = b.assessment_id
                and at.tenant_id = current_setting('app.tenant_id', true)::uuid
                and at.status::text <> 'VOIDED'
            ) as learner_count,
            (
              select avg(lt.score_pct)::float
              from latest lt
              where lt.assessment_id = b.assessment_id
                and lt.score_pct is not null
            ) as avg_score_pct,
            (
              select
                case
                  when count(*) filter (where lt.score_pct is not null and lt.pass_mark is not null) = 0
                    then null
                  else (
                    count(*) filter (
                      where lt.score_pct is not null
                        and lt.pass_mark is not null
                        and lt.score_pct >= lt.pass_mark
                    )::numeric
                    / count(*) filter (
                      where lt.score_pct is not null and lt.pass_mark is not null
                    )::numeric
                  ) * 100
                end
              from latest lt
              where lt.assessment_id = b.assessment_id
            )::float as pass_rate_pct,
            (
              select count(*)::int
              from attempts at
              where at.assessment_id = b.assessment_id
                and at.tenant_id = current_setting('app.tenant_id', true)::uuid
                and at.status::text = 'SUBMITTED'
                and at.score_pct is null
            ) as ungraded_count,
            (
              select max(coalesce(at.submitted_at, at.graded_at, at.started_at))
              from attempts at
              where at.assessment_id = b.assessment_id
                and at.tenant_id = current_setting('app.tenant_id', true)::uuid
                and at.status::text <> 'VOIDED'
            ) as last_attempt_at,
            (
              select min(lt.score_pct)::float
              from latest lt
              where lt.assessment_id = b.assessment_id and lt.score_pct is not null
            ) as spread_min,
            (
              select percentile_cont(0.25) within group (order by lt.score_pct)::float
              from latest lt
              where lt.assessment_id = b.assessment_id and lt.score_pct is not null
            ) as spread_q1,
            (
              select percentile_cont(0.5) within group (order by lt.score_pct)::float
              from latest lt
              where lt.assessment_id = b.assessment_id and lt.score_pct is not null
            ) as spread_median,
            (
              select percentile_cont(0.75) within group (order by lt.score_pct)::float
              from latest lt
              where lt.assessment_id = b.assessment_id and lt.score_pct is not null
            ) as spread_q3,
            (
              select max(lt.score_pct)::float
              from latest lt
              where lt.assessment_id = b.assessment_id and lt.score_pct is not null
            ) as spread_max
          from base b
        )
        select *
        from metrics m
        where (
          ${passRateBand}::text is null
          or (${passRateBand}::text = 'below_50' and m.pass_rate_pct is not null and m.pass_rate_pct < 50)
          or (${passRateBand}::text = 'mid_50_75' and m.pass_rate_pct is not null and m.pass_rate_pct >= 50 and m.pass_rate_pct <= 75)
          or (${passRateBand}::text = 'above_75' and m.pass_rate_pct is not null and m.pass_rate_pct > 75)
        )
        and (${hasUngraded}::boolean = false or m.ungraded_count > 0)
        order by
          case when ${sortBy} = 'title' and ${sortDir} = 'asc' then m.title end asc nulls last,
          case when ${sortBy} = 'title' and ${sortDir} = 'desc' then m.title end desc nulls last,
          case when ${sortBy} = 'attempts' and ${sortDir} = 'asc' then m.attempt_count end asc nulls last,
          case when ${sortBy} = 'attempts' and ${sortDir} = 'desc' then m.attempt_count end desc nulls last,
          case when ${sortBy} = 'avg_score' and ${sortDir} = 'asc' then m.avg_score_pct end asc nulls last,
          case when ${sortBy} = 'avg_score' and ${sortDir} = 'desc' then m.avg_score_pct end desc nulls last,
          case when ${sortBy} = 'pass_rate' and ${sortDir} = 'asc' then m.pass_rate_pct end asc nulls last,
          case when ${sortBy} = 'pass_rate' and ${sortDir} = 'desc' then m.pass_rate_pct end desc nulls last,
          case when ${sortBy} = 'last_attempt' and ${sortDir} = 'asc' then m.last_attempt_at end asc nulls last,
          case when ${sortBy} = 'last_attempt' and ${sortDir} = 'desc' then m.last_attempt_at end desc nulls last,
          case when ${sortBy} = 'ungraded' and ${sortDir} = 'asc' then m.ungraded_count end asc nulls last,
          case when ${sortBy} = 'ungraded' and ${sortDir} = 'desc' then m.ungraded_count end desc nulls last,
          m.title asc
        limit ${query.limit}
        offset ${skip}
      `;
    }

    // Generic path for mock_test / test_series / bundle via assessment id list
    const ids = await this.listAssessmentIds(tx, productType, productId);
    if (ids.length === 0) {
      return countOnly ? [{ count: 0n }] : [];
    }

    if (countOnly) {
      return tx.$queryRaw<Array<Record<string, unknown>>>`
        with base as (
          select
            a.id as assessment_id,
            a.title,
            a.assessment_type,
            null::text as lesson_id,
            a.title as lesson_title,
            nullif(a.config_json->>'passMarkPercent', '')::float as pass_mark
          from assessments a
          where a.tenant_id = current_setting('app.tenant_id', true)::uuid
            and a.deleted_at is null
            and a.id = any(${ids}::uuid[])
            and (${assessmentType}::text is null or a.assessment_type = ${assessmentType})
            and (
              ${q}::text is null
              or lower(a.title) like '%' || lower(${q}) || '%'
            )
        ),
        latest as (
          select distinct on (b.assessment_id, at.membership_id)
            b.assessment_id,
            at.membership_id,
            at.score_pct,
            b.pass_mark
          from base b
          join attempts at
            on at.assessment_id = b.assessment_id
            and at.tenant_id = current_setting('app.tenant_id', true)::uuid
            and at.status::text <> 'VOIDED'
          order by b.assessment_id, at.membership_id,
            coalesce(at.submitted_at, at.graded_at, at.started_at) desc
        ),
        metrics as (
          select
            b.assessment_id::text as assessment_id,
            (
              select
                case
                  when count(*) filter (where lt.score_pct is not null and lt.pass_mark is not null) = 0
                    then null
                  else (
                    count(*) filter (
                      where lt.score_pct is not null
                        and lt.pass_mark is not null
                        and lt.score_pct >= lt.pass_mark
                    )::numeric
                    / count(*) filter (
                      where lt.score_pct is not null and lt.pass_mark is not null
                    )::numeric
                  ) * 100
                end
              from latest lt
              where lt.assessment_id = b.assessment_id
            )::float as pass_rate_pct,
            (
              select count(*)::int
              from attempts at
              where at.assessment_id = b.assessment_id
                and at.tenant_id = current_setting('app.tenant_id', true)::uuid
                and at.status::text = 'SUBMITTED'
                and at.score_pct is null
            ) as ungraded_count
          from base b
        )
        select count(*)::bigint as count
        from metrics m
        where (
          ${passRateBand}::text is null
          or (${passRateBand}::text = 'below_50' and m.pass_rate_pct is not null and m.pass_rate_pct < 50)
          or (${passRateBand}::text = 'mid_50_75' and m.pass_rate_pct is not null and m.pass_rate_pct >= 50 and m.pass_rate_pct <= 75)
          or (${passRateBand}::text = 'above_75' and m.pass_rate_pct is not null and m.pass_rate_pct > 75)
        )
        and (${hasUngraded}::boolean = false or m.ungraded_count > 0)
      `;
    }

    return tx.$queryRaw<Array<Record<string, unknown>>>`
      with base as (
        select
          a.id as assessment_id,
          a.title,
          a.assessment_type,
          null::text as lesson_id,
          a.title as lesson_title,
          nullif(a.config_json->>'passMarkPercent', '')::float as pass_mark
        from assessments a
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
          and a.id = any(${ids}::uuid[])
          and (${assessmentType}::text is null or a.assessment_type = ${assessmentType})
          and (
            ${q}::text is null
            or lower(a.title) like '%' || lower(${q}) || '%'
          )
      ),
      latest as (
        select distinct on (b.assessment_id, at.membership_id)
          b.assessment_id,
          at.membership_id,
          at.score_pct,
          b.pass_mark
        from base b
        join attempts at
          on at.assessment_id = b.assessment_id
          and at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.status::text <> 'VOIDED'
        order by b.assessment_id, at.membership_id,
          coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      ),
      metrics as (
        select
          b.assessment_id::text as assessment_id,
          b.title,
          b.assessment_type,
          b.lesson_id,
          b.lesson_title,
          (
            select count(*)::int
            from assessment_items ai
            where ai.assessment_id = b.assessment_id
              and ai.tenant_id = current_setting('app.tenant_id', true)::uuid
          ) as question_count,
          b.pass_mark as pass_mark_pct,
          (
            select count(*)::int
            from attempts at
            where at.assessment_id = b.assessment_id
              and at.tenant_id = current_setting('app.tenant_id', true)::uuid
              and at.status::text <> 'VOIDED'
          ) as attempt_count,
          (
            select count(distinct at.membership_id)::int
            from attempts at
            where at.assessment_id = b.assessment_id
              and at.tenant_id = current_setting('app.tenant_id', true)::uuid
              and at.status::text <> 'VOIDED'
          ) as learner_count,
          (
            select avg(lt.score_pct)::float
            from latest lt
            where lt.assessment_id = b.assessment_id
              and lt.score_pct is not null
          ) as avg_score_pct,
          (
            select
              case
                when count(*) filter (where lt.score_pct is not null and lt.pass_mark is not null) = 0
                  then null
                else (
                  count(*) filter (
                    where lt.score_pct is not null
                      and lt.pass_mark is not null
                      and lt.score_pct >= lt.pass_mark
                  )::numeric
                  / count(*) filter (
                    where lt.score_pct is not null and lt.pass_mark is not null
                  )::numeric
                ) * 100
              end
            from latest lt
            where lt.assessment_id = b.assessment_id
          )::float as pass_rate_pct,
          (
            select count(*)::int
            from attempts at
            where at.assessment_id = b.assessment_id
              and at.tenant_id = current_setting('app.tenant_id', true)::uuid
              and at.status::text = 'SUBMITTED'
              and at.score_pct is null
          ) as ungraded_count,
          (
            select max(coalesce(at.submitted_at, at.graded_at, at.started_at))
            from attempts at
            where at.assessment_id = b.assessment_id
              and at.tenant_id = current_setting('app.tenant_id', true)::uuid
              and at.status::text <> 'VOIDED'
          ) as last_attempt_at,
          (
            select min(lt.score_pct)::float
            from latest lt
            where lt.assessment_id = b.assessment_id and lt.score_pct is not null
          ) as spread_min,
          (
            select percentile_cont(0.25) within group (order by lt.score_pct)::float
            from latest lt
            where lt.assessment_id = b.assessment_id and lt.score_pct is not null
          ) as spread_q1,
          (
            select percentile_cont(0.5) within group (order by lt.score_pct)::float
            from latest lt
            where lt.assessment_id = b.assessment_id and lt.score_pct is not null
          ) as spread_median,
          (
            select percentile_cont(0.75) within group (order by lt.score_pct)::float
            from latest lt
            where lt.assessment_id = b.assessment_id and lt.score_pct is not null
          ) as spread_q3,
          (
            select max(lt.score_pct)::float
            from latest lt
            where lt.assessment_id = b.assessment_id and lt.score_pct is not null
          ) as spread_max
        from base b
      )
      select *
      from metrics m
      where (
        ${passRateBand}::text is null
        or (${passRateBand}::text = 'below_50' and m.pass_rate_pct is not null and m.pass_rate_pct < 50)
        or (${passRateBand}::text = 'mid_50_75' and m.pass_rate_pct is not null and m.pass_rate_pct >= 50 and m.pass_rate_pct <= 75)
        or (${passRateBand}::text = 'above_75' and m.pass_rate_pct is not null and m.pass_rate_pct > 75)
      )
      and (${hasUngraded}::boolean = false or m.ungraded_count > 0)
      order by
        case when ${sortBy} = 'title' and ${sortDir} = 'asc' then m.title end asc nulls last,
        case when ${sortBy} = 'title' and ${sortDir} = 'desc' then m.title end desc nulls last,
        case when ${sortBy} = 'attempts' and ${sortDir} = 'asc' then m.attempt_count end asc nulls last,
        case when ${sortBy} = 'attempts' and ${sortDir} = 'desc' then m.attempt_count end desc nulls last,
        case when ${sortBy} = 'avg_score' and ${sortDir} = 'asc' then m.avg_score_pct end asc nulls last,
        case when ${sortBy} = 'avg_score' and ${sortDir} = 'desc' then m.avg_score_pct end desc nulls last,
        case when ${sortBy} = 'pass_rate' and ${sortDir} = 'asc' then m.pass_rate_pct end asc nulls last,
        case when ${sortBy} = 'pass_rate' and ${sortDir} = 'desc' then m.pass_rate_pct end desc nulls last,
        case when ${sortBy} = 'last_attempt' and ${sortDir} = 'asc' then m.last_attempt_at end asc nulls last,
        case when ${sortBy} = 'last_attempt' and ${sortDir} = 'desc' then m.last_attempt_at end desc nulls last,
        case when ${sortBy} = 'ungraded' and ${sortDir} = 'asc' then m.ungraded_count end asc nulls last,
        case when ${sortBy} = 'ungraded' and ${sortDir} = 'desc' then m.ungraded_count end desc nulls last,
        m.title asc
      limit ${query.limit}
      offset ${skip}
    `;
  },
};
