import type { TenantTx } from "@atlas/db";
import type {
  ProductPublishStatus,
  ScorePassRateBand,
  ScoreProductSortBy,
  ScoreProductType,
  ScoreProductsQuery,
} from "./progress-score-roster.dto";

function asUnknownString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return fallback;
  return fallback;
}

export type ScorePickerProductRow = {
  id: string;
  title: string;
  slug: string;
  status: ProductPublishStatus;
  assessment_count: number;
  learners_attempted: number;
  attempt_count: number;
  avg_score_pct: number | null;
  pass_mark_pct: number | null;
  pass_rate_pct: number | null;
  ungraded_count: number;
  last_attempt_at: Date | null;
};

export type ScorePickerSummaryRow = {
  product_count: number;
  assessment_count: number;
  attempt_count: number;
};

function mapRow(row: Record<string, unknown>): ScorePickerProductRow {
  return {
    id: asUnknownString(row["id"]),
    title: asUnknownString(row["title"], ""),
    slug: asUnknownString(row["slug"], ""),
    status: asUnknownString(row["status"], "DRAFT") as ProductPublishStatus,
    assessment_count: Number(row["assessment_count"] ?? 0),
    learners_attempted: Number(row["learners_attempted"] ?? 0),
    attempt_count: Number(row["attempt_count"] ?? 0),
    avg_score_pct: row["avg_score_pct"] == null ? null : Number(row["avg_score_pct"]),
    pass_mark_pct: row["pass_mark_pct"] == null ? null : Number(row["pass_mark_pct"]),
    pass_rate_pct: row["pass_rate_pct"] == null ? null : Number(row["pass_rate_pct"]),
    ungraded_count: Number(row["ungraded_count"] ?? 0),
    last_attempt_at: row["last_attempt_at"] instanceof Date ? row["last_attempt_at"] : null,
  };
}

function passRateBandSql(band: ScorePassRateBand | null | undefined) {
  return band ?? null;
}

export const progressScorePickerRepository = {
  async summarizeScoreProducts(
    tx: TenantTx,
    productType: ScoreProductType,
    filters: {
      q?: string;
      status?: ProductPublishStatus;
    },
  ): Promise<ScorePickerSummaryRow> {
    const q = filters.q ?? null;
    const status = filters.status ?? null;

    if (productType === "course") {
      const rows = await tx.$queryRaw<Array<ScorePickerSummaryRow>>`
        with course_assessments as (
          select distinct
            c.id as product_id,
            a.id as assessment_id
          from courses c
          join course_modules cm
            on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
          join lessons l
            on l.module_id = cm.id and l.tenant_id = cm.tenant_id and l.deleted_at is null
          join assessments a
            on a.tenant_id = c.tenant_id
            and a.deleted_at is null
            and coalesce(
              l.content_json->'content'->>'assessmentId',
              l.content_json->>'assessmentId'
            ) = a.id::text
          where c.tenant_id = current_setting('app.tenant_id', true)::uuid
            and c.deleted_at is null
            and (${status}::text is null or c.status::text = ${status})
            and (
              ${q}::text is null
              or lower(c.title) like '%' || lower(${q}) || '%'
              or lower(c.slug) like '%' || lower(${q}) || '%'
            )
        )
        select
          (
            select count(*)::int
            from courses c
            where c.tenant_id = current_setting('app.tenant_id', true)::uuid
              and c.deleted_at is null
              and (${status}::text is null or c.status::text = ${status})
              and (
                ${q}::text is null
                or lower(c.title) like '%' || lower(${q}) || '%'
                or lower(c.slug) like '%' || lower(${q}) || '%'
              )
          ) as product_count,
          (select count(distinct assessment_id)::int from course_assessments) as assessment_count,
          (
            select count(*)::int
            from attempts at
            join course_assessments ca on ca.assessment_id = at.assessment_id
            where at.tenant_id = current_setting('app.tenant_id', true)::uuid
              and at.status::text <> 'VOIDED'
          ) as attempt_count
      `;
      return rows[0] ?? { product_count: 0, assessment_count: 0, attempt_count: 0 };
    }

    if (productType === "mock_test") {
      const rows = await tx.$queryRaw<Array<ScorePickerSummaryRow>>`
        select
          count(*)::int as product_count,
          count(*)::int as assessment_count,
          (
            select count(*)::int
            from attempts at
            join mock_tests mt2 on mt2.assessment_id = at.assessment_id and mt2.tenant_id = at.tenant_id
            where at.tenant_id = current_setting('app.tenant_id', true)::uuid
              and at.status::text <> 'VOIDED'
              and mt2.deleted_at is null
              and (${status}::text is null or mt2.status::text = ${status})
              and (
                ${q}::text is null
                or lower(mt2.title) like '%' || lower(${q}) || '%'
                or lower(mt2.slug) like '%' || lower(${q}) || '%'
              )
          ) as attempt_count
        from mock_tests mt
        where mt.tenant_id = current_setting('app.tenant_id', true)::uuid
          and mt.deleted_at is null
          and (${status}::text is null or mt.status::text = ${status})
          and (
            ${q}::text is null
            or lower(mt.title) like '%' || lower(${q}) || '%'
            or lower(mt.slug) like '%' || lower(${q}) || '%'
          )
      `;
      return rows[0] ?? { product_count: 0, assessment_count: 0, attempt_count: 0 };
    }

    if (productType === "test_series") {
      const rows = await tx.$queryRaw<Array<ScorePickerSummaryRow>>`
        with series_assessments as (
          select distinct ts.id as product_id, a.id as assessment_id
          from test_series ts
          join test_series_items tsi on tsi.test_series_id = ts.id and tsi.tenant_id = ts.tenant_id
          join assessments a on a.id = coalesce(
            tsi.assessment_id,
            (select mt.assessment_id from mock_tests mt where mt.id = tsi.mock_test_id and mt.deleted_at is null)
          ) and a.tenant_id = ts.tenant_id and a.deleted_at is null
          where ts.tenant_id = current_setting('app.tenant_id', true)::uuid
            and ts.deleted_at is null
            and (${status}::text is null or ts.status::text = ${status})
            and (
              ${q}::text is null
              or lower(ts.title) like '%' || lower(${q}) || '%'
              or lower(ts.slug) like '%' || lower(${q}) || '%'
            )
        )
        select
          (
            select count(*)::int from test_series ts
            where ts.tenant_id = current_setting('app.tenant_id', true)::uuid
              and ts.deleted_at is null
              and (${status}::text is null or ts.status::text = ${status})
              and (
                ${q}::text is null
                or lower(ts.title) like '%' || lower(${q}) || '%'
                or lower(ts.slug) like '%' || lower(${q}) || '%'
              )
          ) as product_count,
          (select count(distinct assessment_id)::int from series_assessments) as assessment_count,
          (
            select count(*)::int
            from attempts at
            join series_assessments sa on sa.assessment_id = at.assessment_id
            where at.tenant_id = current_setting('app.tenant_id', true)::uuid
              and at.status::text <> 'VOIDED'
          ) as attempt_count
      `;
      return rows[0] ?? { product_count: 0, assessment_count: 0, attempt_count: 0 };
    }

    const rows = await tx.$queryRaw<Array<ScorePickerSummaryRow>>`
      select
        count(*)::int as product_count,
        0::int as assessment_count,
        0::int as attempt_count
      from bundles b
      where b.tenant_id = current_setting('app.tenant_id', true)::uuid
        and b.deleted_at is null
        and (${status}::text is null or b.status::text = ${status})
        and (
          ${q}::text is null
          or lower(b.title) like '%' || lower(${q}) || '%'
          or lower(b.slug) like '%' || lower(${q}) || '%'
        )
    `;
    return rows[0] ?? { product_count: 0, assessment_count: 0, attempt_count: 0 };
  },

  async countScoreProducts(
    tx: TenantTx,
    productType: ScoreProductType,
    query: ScoreProductsQuery,
  ): Promise<number> {
    // Reuse list with a high cap for filtered count when filters need post-aggregation.
    // For unfiltered cases, fall back to cheap product counts.
    if (!query.passRateBand && query.hasUngraded !== true && !query.q && !query.status) {
      if (productType === "course") {
        const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
          select count(*)::bigint as count
          from courses c
          where c.tenant_id = current_setting('app.tenant_id', true)::uuid
            and c.deleted_at is null
        `;
        return Number(rows[0]?.count ?? 0);
      }
      if (productType === "mock_test") {
        const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
          select count(*)::bigint as count
          from mock_tests mt
          where mt.tenant_id = current_setting('app.tenant_id', true)::uuid
            and mt.deleted_at is null
        `;
        return Number(rows[0]?.count ?? 0);
      }
      if (productType === "test_series") {
        const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
          select count(*)::bigint as count
          from test_series ts
          where ts.tenant_id = current_setting('app.tenant_id', true)::uuid
            and ts.deleted_at is null
        `;
        return Number(rows[0]?.count ?? 0);
      }
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from bundles b
        where b.tenant_id = current_setting('app.tenant_id', true)::uuid
          and b.deleted_at is null
      `;
      return Number(rows[0]?.count ?? 0);
    }

    const all = await this.listScoreProducts(tx, productType, {
      ...query,
      page: 1,
      limit: 5000,
    });
    return all.length;
  },

  async listScoreProducts(
    tx: TenantTx,
    productType: ScoreProductType,
    query: {
      q?: string | undefined;
      status?: ProductPublishStatus | undefined;
      passRateBand?: ScorePassRateBand | undefined;
      hasUngraded?: boolean | undefined;
      sortBy: ScoreProductSortBy;
      sortDir: "asc" | "desc";
      limit: number;
      page: number;
    },
  ): Promise<ScorePickerProductRow[]> {
    const skip = (query.page - 1) * query.limit;
    const q = query.q ?? null;
    const status = query.status ?? null;
    const passRateBand = passRateBandSql(query.passRateBand);
    const hasUngraded = query.hasUngraded === true;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;

    if (productType === "course") {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        with course_assessments as (
          select
            c.id as product_id,
            c.title,
            c.slug,
            c.status::text as status,
            a.id as assessment_id,
            nullif(a.config_json->>'passMarkPercent', '')::float as pass_mark
          from courses c
          join course_modules cm
            on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
          join lessons l
            on l.module_id = cm.id and l.tenant_id = cm.tenant_id and l.deleted_at is null
          join assessments a
            on a.tenant_id = c.tenant_id
            and a.deleted_at is null
            and coalesce(
              l.content_json->'content'->>'assessmentId',
              l.content_json->>'assessmentId'
            ) = a.id::text
          where c.tenant_id = current_setting('app.tenant_id', true)::uuid
            and c.deleted_at is null
            and (${status}::text is null or c.status::text = ${status})
            and (
              ${q}::text is null
              or lower(c.title) like '%' || lower(${q}) || '%'
              or lower(c.slug) like '%' || lower(${q}) || '%'
            )
        ),
        products as (
          select distinct product_id, title, slug, status
          from course_assessments
          union
          select c.id, c.title, c.slug, c.status::text
          from courses c
          where c.tenant_id = current_setting('app.tenant_id', true)::uuid
            and c.deleted_at is null
            and (${status}::text is null or c.status::text = ${status})
            and (
              ${q}::text is null
              or lower(c.title) like '%' || lower(${q}) || '%'
              or lower(c.slug) like '%' || lower(${q}) || '%'
            )
        ),
        latest as (
          select distinct on (ca.product_id, at.membership_id, at.assessment_id)
            ca.product_id,
            at.membership_id,
            at.assessment_id,
            at.score_pct,
            ca.pass_mark,
            at.status::text as attempt_status,
            coalesce(at.submitted_at, at.graded_at, at.started_at) as attempt_at
          from course_assessments ca
          join attempts at
            on at.assessment_id = ca.assessment_id
            and at.tenant_id = current_setting('app.tenant_id', true)::uuid
            and at.status::text <> 'VOIDED'
          order by ca.product_id, at.membership_id, at.assessment_id,
            coalesce(at.submitted_at, at.graded_at, at.started_at) desc
        ),
        metrics as (
          select
            p.product_id as id,
            p.title,
            p.slug,
            p.status,
            (
              select count(distinct ca.assessment_id)::int
              from course_assessments ca
              where ca.product_id = p.product_id
            ) as assessment_count,
            (
              select count(distinct lt.membership_id)::int
              from latest lt
              where lt.product_id = p.product_id
            ) as learners_attempted,
            (
              select count(*)::int
              from attempts at
              join course_assessments ca on ca.assessment_id = at.assessment_id and ca.product_id = p.product_id
              where at.tenant_id = current_setting('app.tenant_id', true)::uuid
                and at.status::text <> 'VOIDED'
            ) as attempt_count,
            (
              select avg(lt.score_pct)::float
              from latest lt
              where lt.product_id = p.product_id
                and lt.score_pct is not null
            ) as avg_score_pct,
            (
              select avg(ca.pass_mark)::float
              from course_assessments ca
              where ca.product_id = p.product_id
                and ca.pass_mark is not null
            ) as pass_mark_pct,
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
              where lt.product_id = p.product_id
            )::float as pass_rate_pct,
            (
              select count(*)::int
              from attempts at
              join course_assessments ca on ca.assessment_id = at.assessment_id and ca.product_id = p.product_id
              where at.tenant_id = current_setting('app.tenant_id', true)::uuid
                and at.status::text = 'SUBMITTED'
                and at.score_pct is null
            ) as ungraded_count,
            (
              select max(coalesce(at.submitted_at, at.graded_at, at.started_at))
              from attempts at
              join course_assessments ca on ca.assessment_id = at.assessment_id and ca.product_id = p.product_id
              where at.tenant_id = current_setting('app.tenant_id', true)::uuid
                and at.status::text <> 'VOIDED'
            ) as last_attempt_at
          from products p
        )
        select *
        from metrics m
        where (
          ${passRateBand}::text is null
          or (
            ${passRateBand}::text = 'below_50'
            and m.pass_rate_pct is not null
            and m.pass_rate_pct < 50
          )
          or (
            ${passRateBand}::text = 'mid_50_75'
            and m.pass_rate_pct is not null
            and m.pass_rate_pct >= 50
            and m.pass_rate_pct <= 75
          )
          or (
            ${passRateBand}::text = 'above_75'
            and m.pass_rate_pct is not null
            and m.pass_rate_pct > 75
          )
        )
        and (
          ${hasUngraded}::boolean = false
          or m.ungraded_count > 0
        )
        order by
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
          case when ${sortBy} = 'title' and ${sortDir} = 'asc' then m.title end asc,
          case when ${sortBy} = 'title' and ${sortDir} = 'desc' then m.title end desc,
          m.title asc
        limit ${query.limit}
        offset ${skip}
      `;
      return rows.map(mapRow);
    }

    if (productType === "mock_test") {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        with products as (
          select
            mt.id as product_id,
            mt.title,
            mt.slug,
            mt.status::text as status,
            mt.assessment_id,
            nullif(a.config_json->>'passMarkPercent', '')::float as pass_mark
          from mock_tests mt
          join assessments a on a.id = mt.assessment_id and a.tenant_id = mt.tenant_id and a.deleted_at is null
          where mt.tenant_id = current_setting('app.tenant_id', true)::uuid
            and mt.deleted_at is null
            and (${status}::text is null or mt.status::text = ${status})
            and (
              ${q}::text is null
              or lower(mt.title) like '%' || lower(${q}) || '%'
              or lower(mt.slug) like '%' || lower(${q}) || '%'
            )
        ),
        latest as (
          select distinct on (p.product_id, at.membership_id)
            p.product_id,
            at.membership_id,
            at.score_pct,
            p.pass_mark,
            coalesce(at.submitted_at, at.graded_at, at.started_at) as attempt_at
          from products p
          join attempts at
            on at.assessment_id = p.assessment_id
            and at.tenant_id = current_setting('app.tenant_id', true)::uuid
            and at.status::text <> 'VOIDED'
          order by p.product_id, at.membership_id,
            coalesce(at.submitted_at, at.graded_at, at.started_at) desc
        ),
        metrics as (
          select
            p.product_id as id,
            p.title,
            p.slug,
            p.status,
            1::int as assessment_count,
            (select count(distinct lt.membership_id)::int from latest lt where lt.product_id = p.product_id) as learners_attempted,
            (
              select count(*)::int
              from attempts at
              where at.assessment_id = p.assessment_id
                and at.tenant_id = current_setting('app.tenant_id', true)::uuid
                and at.status::text <> 'VOIDED'
            ) as attempt_count,
            (select avg(lt.score_pct)::float from latest lt where lt.product_id = p.product_id and lt.score_pct is not null) as avg_score_pct,
            p.pass_mark as pass_mark_pct,
            (
              select
                case
                  when count(*) filter (where lt.score_pct is not null and lt.pass_mark is not null) = 0 then null
                  else (
                    count(*) filter (
                      where lt.score_pct is not null and lt.pass_mark is not null and lt.score_pct >= lt.pass_mark
                    )::numeric
                    / count(*) filter (where lt.score_pct is not null and lt.pass_mark is not null)::numeric
                  ) * 100
                end
              from latest lt
              where lt.product_id = p.product_id
            )::float as pass_rate_pct,
            (
              select count(*)::int
              from attempts at
              where at.assessment_id = p.assessment_id
                and at.tenant_id = current_setting('app.tenant_id', true)::uuid
                and at.status::text = 'SUBMITTED'
                and at.score_pct is null
            ) as ungraded_count,
            (
              select max(coalesce(at.submitted_at, at.graded_at, at.started_at))
              from attempts at
              where at.assessment_id = p.assessment_id
                and at.tenant_id = current_setting('app.tenant_id', true)::uuid
                and at.status::text <> 'VOIDED'
            ) as last_attempt_at
          from products p
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
          case when ${sortBy} = 'title' and ${sortDir} = 'asc' then m.title end asc,
          case when ${sortBy} = 'title' and ${sortDir} = 'desc' then m.title end desc,
          m.title asc
        limit ${query.limit}
        offset ${skip}
      `;
      return rows.map(mapRow);
    }

    if (productType === "test_series") {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        with series_assessments as (
          select
            ts.id as product_id,
            ts.title,
            ts.slug,
            ts.status::text as status,
            a.id as assessment_id,
            nullif(a.config_json->>'passMarkPercent', '')::float as pass_mark
          from test_series ts
          join test_series_items tsi
            on tsi.test_series_id = ts.id and tsi.tenant_id = ts.tenant_id
          join assessments a on a.id = coalesce(
            tsi.assessment_id,
            (select mt.assessment_id from mock_tests mt where mt.id = tsi.mock_test_id and mt.deleted_at is null)
          ) and a.tenant_id = ts.tenant_id and a.deleted_at is null
          where ts.tenant_id = current_setting('app.tenant_id', true)::uuid
            and ts.deleted_at is null
            and (${status}::text is null or ts.status::text = ${status})
            and (
              ${q}::text is null
              or lower(ts.title) like '%' || lower(${q}) || '%'
              or lower(ts.slug) like '%' || lower(${q}) || '%'
            )
        ),
        products as (
          select distinct product_id, title, slug, status from series_assessments
          union
          select ts.id, ts.title, ts.slug, ts.status::text
          from test_series ts
          where ts.tenant_id = current_setting('app.tenant_id', true)::uuid
            and ts.deleted_at is null
            and (${status}::text is null or ts.status::text = ${status})
            and (
              ${q}::text is null
              or lower(ts.title) like '%' || lower(${q}) || '%'
              or lower(ts.slug) like '%' || lower(${q}) || '%'
            )
        ),
        latest as (
          select distinct on (sa.product_id, at.membership_id, at.assessment_id)
            sa.product_id,
            at.membership_id,
            at.assessment_id,
            at.score_pct,
            sa.pass_mark
          from series_assessments sa
          join attempts at
            on at.assessment_id = sa.assessment_id
            and at.tenant_id = current_setting('app.tenant_id', true)::uuid
            and at.status::text <> 'VOIDED'
          order by sa.product_id, at.membership_id, at.assessment_id,
            coalesce(at.submitted_at, at.graded_at, at.started_at) desc
        ),
        metrics as (
          select
            p.product_id as id,
            p.title,
            p.slug,
            p.status,
            (select count(distinct sa.assessment_id)::int from series_assessments sa where sa.product_id = p.product_id) as assessment_count,
            (select count(distinct lt.membership_id)::int from latest lt where lt.product_id = p.product_id) as learners_attempted,
            (
              select count(*)::int
              from attempts at
              join series_assessments sa on sa.assessment_id = at.assessment_id and sa.product_id = p.product_id
              where at.tenant_id = current_setting('app.tenant_id', true)::uuid
                and at.status::text <> 'VOIDED'
            ) as attempt_count,
            (select avg(lt.score_pct)::float from latest lt where lt.product_id = p.product_id and lt.score_pct is not null) as avg_score_pct,
            (select avg(sa.pass_mark)::float from series_assessments sa where sa.product_id = p.product_id and sa.pass_mark is not null) as pass_mark_pct,
            (
              select
                case
                  when count(*) filter (where lt.score_pct is not null and lt.pass_mark is not null) = 0 then null
                  else (
                    count(*) filter (
                      where lt.score_pct is not null and lt.pass_mark is not null and lt.score_pct >= lt.pass_mark
                    )::numeric
                    / count(*) filter (where lt.score_pct is not null and lt.pass_mark is not null)::numeric
                  ) * 100
                end
              from latest lt where lt.product_id = p.product_id
            )::float as pass_rate_pct,
            (
              select count(*)::int
              from attempts at
              join series_assessments sa on sa.assessment_id = at.assessment_id and sa.product_id = p.product_id
              where at.tenant_id = current_setting('app.tenant_id', true)::uuid
                and at.status::text = 'SUBMITTED'
                and at.score_pct is null
            ) as ungraded_count,
            (
              select max(coalesce(at.submitted_at, at.graded_at, at.started_at))
              from attempts at
              join series_assessments sa on sa.assessment_id = at.assessment_id and sa.product_id = p.product_id
              where at.tenant_id = current_setting('app.tenant_id', true)::uuid
                and at.status::text <> 'VOIDED'
            ) as last_attempt_at
          from products p
        )
        select * from metrics m
        where (
          ${passRateBand}::text is null
          or (${passRateBand}::text = 'below_50' and m.pass_rate_pct is not null and m.pass_rate_pct < 50)
          or (${passRateBand}::text = 'mid_50_75' and m.pass_rate_pct is not null and m.pass_rate_pct >= 50 and m.pass_rate_pct <= 75)
          or (${passRateBand}::text = 'above_75' and m.pass_rate_pct is not null and m.pass_rate_pct > 75)
        )
        and (${hasUngraded}::boolean = false or m.ungraded_count > 0)
        order by
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
          case when ${sortBy} = 'title' and ${sortDir} = 'asc' then m.title end asc,
          case when ${sortBy} = 'title' and ${sortDir} = 'desc' then m.title end desc,
          m.title asc
        limit ${query.limit}
        offset ${skip}
      `;
      return rows.map(mapRow);
    }

    // Honest degradation: list bundles with assessment counts via existing quiz counter pattern.
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        b.id::text as id,
        b.title,
        b.slug,
        b.status::text as status,
        coalesce(qz.assessment_count, 0)::int as assessment_count,
        0::int as learners_attempted,
        0::int as attempt_count,
        null::float as avg_score_pct,
        null::float as pass_mark_pct,
        null::float as pass_rate_pct,
        0::int as ungraded_count,
        null::timestamptz as last_attempt_at
      from bundles b
      left join lateral (
        select count(distinct a.id)::int as assessment_count
        from bundle_items bi
        join assessments a on a.tenant_id = bi.tenant_id and a.deleted_at is null
        left join lessons l on bi.item_kind = 'course'
          and l.deleted_at is null
          and l.tenant_id = bi.tenant_id
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        left join course_modules cm on bi.item_kind = 'course'
          and cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null and cm.course_id = bi.ref_id
        left join mock_tests mt on bi.item_kind = 'mock_test'
          and mt.id = bi.ref_id and mt.deleted_at is null and mt.assessment_id = a.id
        left join test_series_items tsi on bi.item_kind = 'test_series'
          and tsi.test_series_id = bi.ref_id and tsi.tenant_id = bi.tenant_id
          and a.id = coalesce(
            tsi.assessment_id,
            (select mt2.assessment_id from mock_tests mt2 where mt2.id = tsi.mock_test_id and mt2.deleted_at is null)
          )
        where bi.bundle_id = b.id
          and bi.tenant_id = b.tenant_id
          and (
            (bi.item_kind = 'course' and cm.id is not null)
            or (bi.item_kind = 'mock_test' and mt.id is not null)
            or (bi.item_kind = 'test_series' and tsi.id is not null)
          )
      ) qz on true
      where b.tenant_id = current_setting('app.tenant_id', true)::uuid
        and b.deleted_at is null
        and (${status}::text is null or b.status::text = ${status})
        and (
          ${q}::text is null
          or lower(b.title) like '%' || lower(${q}) || '%'
          or lower(b.slug) like '%' || lower(${q}) || '%'
        )
        and (${hasUngraded}::boolean = false)
        and (${passRateBand}::text is null)
      order by
        case when ${sortBy} = 'title' and ${sortDir} = 'asc' then b.title end asc,
        case when ${sortBy} = 'title' and ${sortDir} = 'desc' then b.title end desc,
        case when ${sortBy} = 'attempts' and ${sortDir} = 'desc' then coalesce(qz.assessment_count, 0) end desc,
        b.title asc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map(mapRow);
  },
};
