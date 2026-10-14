import type { TenantTx } from "@atlas/db";
import type {
  ProgressCoursesQuery,
  ProgressProductsQuery,
  ProgressProductType,
  ProductPublishStatus,
  ScoreProductType,
} from "./progress-score-roster.dto";
import type { ProgressCourseRow, ProgressProductRow } from "./progress-score-roster.repository";

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
    sortBy: "sortBy" in query ? query.sortBy : "title",
    sortDir: "sortDir" in query ? query.sortDir : "asc",
    limit: query.limit,
    page: query.page,
  };
}

/**
 * The products list and its summary.
 * Part of progressScoreRosterRepository.
 */
export const progressScoreRosterProductsRepository = {
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
    filters?: { q?: string | undefined; status?: ProductPublishStatus | undefined },
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
        productCount: rows[0]?.product_count ?? 0,
        enrolmentCount: rows[0]?.enrolment_count ?? 0,
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
        productCount: rows[0]?.product_count ?? 0,
        enrolmentCount: rows[0]?.enrolment_count ?? 0,
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
        productCount: rows[0]?.product_count ?? 0,
        enrolmentCount: rows[0]?.enrolment_count ?? 0,
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
        productCount: rows[0]?.product_count ?? 0,
        enrolmentCount: rows[0]?.enrolment_count ?? 0,
      };
    }
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
      productCount: rows[0]?.product_count ?? 0,
      enrolmentCount: rows[0]?.enrolment_count ?? 0,
    };
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
  },
};
