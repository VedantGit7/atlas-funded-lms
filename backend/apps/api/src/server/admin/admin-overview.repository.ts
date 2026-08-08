type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type AdminOverviewRaw = {
  currency: string;
  enrollmentValueCents: number;
  productCount: number;
  learnerCount: number;
  enrollmentCount: number;
  last12MonthsValueCents: number;
  paidValueCents: number;
  freeEnrollmentCount: number;
  paidEnrollmentCount: number;
  monthly: Array<{ month: Date; paid: bigint; free: bigint }>;
  topProducts: Array<{
    id: string;
    title: string;
    student_count: bigint;
    price_cents: number | null;
    currency: string | null;
  }>;
  scheduledEvents: Array<{
    id: string;
    name: string;
    status: string;
    starts_at: Date;
    ends_at: Date;
  }>;
  publishReviews: number;
  moderationCases: number;
  deletionRequests: number;
  courseReviews: number;
};

function asNumber(value: bigint | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "bigint" ? Number(value) : value;
}

export async function loadAdminOverviewRaw(args: {
  tx: Tx;
  tenantId: string;
}): Promise<AdminOverviewRaw> {
  const tenantId = args.tenantId;

  const [kpiRows, monthlyRows, topRows, eventRows, taskRows] = await Promise.all([
    args.tx.$queryRaw<
      Array<{
        currency: string | null;
        enrollment_value_cents: bigint;
        product_count: bigint;
        learner_count: bigint;
        enrollment_count: bigint;
        last_12_months_value_cents: bigint;
        paid_value_cents: bigint;
        free_enrollment_count: bigint;
        paid_enrollment_count: bigint;
      }>
    >`
      with course_pricing as (
        select
          c.id,
          c.title,
          c.status,
          c.deleted_at,
          case
            when coalesce(c.metadata_json->>'accessTier', 'FREE') = 'PAID'
              then greatest(coalesce((c.metadata_json->>'priceCents')::int, 0), 0)
            else 0
          end as price_cents,
          nullif(c.metadata_json->>'currency', '') as currency
        from courses c
        where c.tenant_id = ${tenantId}::uuid
      ),
      enrollment_stats as (
        select
          count(*) filter (where e.status = 'active')::bigint as enrollment_count,
          count(*) filter (
            where e.status = 'active' and cp.price_cents > 0
          )::bigint as paid_enrollment_count,
          count(*) filter (
            where e.status = 'active' and cp.price_cents = 0
          )::bigint as free_enrollment_count,
          coalesce(sum(cp.price_cents) filter (where e.status = 'active'), 0)::bigint as enrollment_value_cents,
          coalesce(
            sum(cp.price_cents) filter (
              where e.status = 'active' and e.enrolled_at >= date_trunc('month', now()) - interval '11 months'
            ),
            0
          )::bigint as last_12_months_value_cents,
          coalesce(sum(cp.price_cents) filter (where e.status = 'active' and cp.price_cents > 0), 0)::bigint
            as paid_value_cents
        from enrollments e
        join course_pricing cp on cp.id = e.course_id
        where e.tenant_id = ${tenantId}::uuid
      )
      select
        coalesce(
          (select currency from course_pricing where currency is not null limit 1),
          'INR'
        ) as currency,
        coalesce(es.enrollment_value_cents, 0)::bigint as enrollment_value_cents,
        (
          select count(*)::bigint
          from courses c
          where c.tenant_id = ${tenantId}::uuid
            and c.deleted_at is null
            and c.status = 'PUBLISHED'
        ) as product_count,
        (
          select count(*)::bigint
          from memberships m
          where m.tenant_id = ${tenantId}::uuid
            and m.status = 'ACTIVE'
            and m.archived_at is null
        ) as learner_count,
        coalesce(es.enrollment_count, 0)::bigint as enrollment_count,
        coalesce(es.last_12_months_value_cents, 0)::bigint as last_12_months_value_cents,
        coalesce(es.paid_value_cents, 0)::bigint as paid_value_cents,
        coalesce(es.free_enrollment_count, 0)::bigint as free_enrollment_count,
        coalesce(es.paid_enrollment_count, 0)::bigint as paid_enrollment_count
      from (select 1) as _seed
      left join enrollment_stats es on true
    `,
    args.tx.$queryRaw<Array<{ month: Date; paid: bigint; free: bigint }>>`
      with course_pricing as (
        select
          c.id,
          case
            when coalesce(c.metadata_json->>'accessTier', 'FREE') = 'PAID'
              then greatest(coalesce((c.metadata_json->>'priceCents')::int, 0), 0)
            else 0
          end as price_cents
        from courses c
        where c.tenant_id = ${tenantId}::uuid
      ),
      months as (
        select generate_series(
          date_trunc('month', now()) - interval '11 months',
          date_trunc('month', now()),
          interval '1 month'
        ) as month
      )
      select
        m.month,
        coalesce(sum(case when cp.price_cents > 0 then 1 else 0 end), 0)::bigint as paid,
        coalesce(sum(case when cp.price_cents = 0 then 1 else 0 end), 0)::bigint as free
      from months m
      left join enrollments e
        on e.tenant_id = ${tenantId}::uuid
        and e.status = 'active'
        and date_trunc('month', e.enrolled_at) = m.month
      left join course_pricing cp on cp.id = e.course_id
      group by m.month
      order by m.month asc
    `,
    args.tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        student_count: bigint;
        price_cents: number | null;
        currency: string | null;
      }>
    >`
      select
        c.id,
        c.title,
        count(e.id)::bigint as student_count,
        case
          when coalesce(c.metadata_json->>'accessTier', 'FREE') = 'PAID'
            then greatest(coalesce((c.metadata_json->>'priceCents')::int, 0), 0)
          else null
        end as price_cents,
        nullif(c.metadata_json->>'currency', '') as currency
      from courses c
      left join enrollments e
        on e.course_id = c.id
        and e.tenant_id = c.tenant_id
        and e.status = 'active'
      where c.tenant_id = ${tenantId}::uuid
        and c.deleted_at is null
        and c.status = 'PUBLISHED'
      group by c.id, c.title, c.metadata_json
      order by student_count desc, c.title asc
      limit 5
    `,
    args.tx.$queryRaw<
      Array<{ id: string; name: string; status: string; starts_at: Date; ends_at: Date }>
    >`
      select id, name, status, starts_at, ends_at
      from seasonal_events
      where tenant_id = ${tenantId}::uuid
        and status in ('scheduled', 'active')
        and ends_at >= now()
      order by starts_at asc
      limit 8
    `,
    args.tx.$queryRaw<
      Array<{
        publish_reviews: bigint;
        moderation_cases: bigint;
        deletion_requests: bigint;
        course_reviews: bigint;
      }>
    >`
      select
        (
          select count(*)::bigint
          from courses c
          where c.tenant_id = ${tenantId}::uuid
            and c.deleted_at is null
            and c.status = 'REVIEW'
        ) as publish_reviews,
        (
          select count(*)::bigint
          from moderation_cases mc
          where mc.tenant_id = ${tenantId}::uuid
            and mc.status in ('OPEN', 'REVIEWING')
        ) as moderation_cases,
        (
          select count(*)::bigint
          from deletion_requests dr
          where dr.tenant_id = ${tenantId}::uuid
            and dr.status in ('QUEUED', 'RUNNING')
        ) as deletion_requests,
        (
          select count(*)::bigint
          from course_reviews cr
          where cr.tenant_id = ${tenantId}::uuid
            and coalesce(cr.status, 'APPROVED') = 'PENDING'
            and cr.created_at >= now() - interval '30 days'
        ) as course_reviews
    `,
  ]);

  const kpi = kpiRows[0];
  const tasks = taskRows[0];

  return {
    currency: kpi?.currency?.trim() || "INR",
    enrollmentValueCents: asNumber(kpi?.enrollment_value_cents),
    productCount: asNumber(kpi?.product_count),
    learnerCount: asNumber(kpi?.learner_count),
    enrollmentCount: asNumber(kpi?.enrollment_count),
    last12MonthsValueCents: asNumber(kpi?.last_12_months_value_cents),
    paidValueCents: asNumber(kpi?.paid_value_cents),
    freeEnrollmentCount: asNumber(kpi?.free_enrollment_count),
    paidEnrollmentCount: asNumber(kpi?.paid_enrollment_count),
    monthly: monthlyRows,
    topProducts: topRows,
    scheduledEvents: eventRows,
    publishReviews: asNumber(tasks?.publish_reviews),
    moderationCases: asNumber(tasks?.moderation_cases),
    deletionRequests: asNumber(tasks?.deletion_requests),
    courseReviews: asNumber(tasks?.course_reviews),
  };
}
