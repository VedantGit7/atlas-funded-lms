import type { TenantTx } from "@atlas/db";
import {
  resolveInsightRangeWindow,
  type InsightDashboardRange,
  type InsightRangeWindow,
} from "./insights-range";

export async function countSalesEventsByType(tx: TenantTx) {
  const rows = await tx.$queryRaw<Array<{ event_type: string; count: bigint }>>`
    select event_type, count(*) as count
    from sales_attribution_events
    group by event_type
    order by count desc
    limit 10
  `;
  return rows.map((row) => ({ eventType: row.event_type, count: Number(row.count) }));
}

export async function countAttributionBySource(tx: TenantTx) {
  const rows = await tx.$queryRaw<Array<{ utm_source: string | null; count: bigint }>>`
    select coalesce(utm_source, 'direct') as utm_source, count(*) as count
    from sales_attribution_events
    group by coalesce(utm_source, 'direct')
    order by count desc
    limit 10
  `;
  return rows.map((row) => ({
    source: row.utm_source ?? "direct",
    count: Number(row.count),
  }));
}

export async function countSalesEventsTotal(tx: TenantTx): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
    select count(*) as count from sales_attribution_events
  `;
  return Number(rows[0]?.count ?? 0);
}

export type SalesAttributionSourceRow = {
  source: string;
  medium: string;
  count: number;
  revenueCents: number;
};

export type SalesOpportunityEvidence = {
  paidProductCount: number;
  trialExpiring7d: number;
  trialLapsed: number;
  freeActive30d: number;
  freeDormant: number;
};

export async function loadSalesOpportunityEvidence(
  tx: TenantTx,
): Promise<SalesOpportunityEvidence> {
  const rows = await tx.$queryRaw<
    Array<{
      paid_product_count: bigint;
      trial_expiring_7d: bigint;
      trial_lapsed: bigint;
      free_active_30d: bigint;
      free_dormant: bigint;
    }>
  >`
    select
      (
        select count(distinct course_id)::bigint
        from enrollments
        where status = 'active' and enrolled_type = 'paid'
      ) as paid_product_count,
      (
        select count(*)::bigint
        from enrollments
        where status = 'active'
          and enrolled_type = 'trial'
          and expires_at is not null
          and expires_at >= now()
          and expires_at < now() + interval '7 days'
      ) as trial_expiring_7d,
      (
        select count(*)::bigint
        from enrollments
        where status = 'active'
          and enrolled_type = 'trial'
          and expires_at is not null
          and expires_at < now()
      ) as trial_lapsed,
      (
        select count(*)::bigint
        from enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        where e.status = 'active'
          and e.enrolled_type = 'free'
          and m.last_active_at is not null
          and m.last_active_at >= now() - interval '30 days'
      ) as free_active_30d,
      (
        select count(*)::bigint
        from enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        where e.status = 'active'
          and e.enrolled_type = 'free'
          and (m.last_active_at is null or m.last_active_at < now() - interval '30 days')
      ) as free_dormant
  `;
  const row = rows[0];
  return {
    paidProductCount: asNumber(row?.paid_product_count),
    trialExpiring7d: asNumber(row?.trial_expiring_7d),
    trialLapsed: asNumber(row?.trial_lapsed),
    freeActive30d: asNumber(row?.free_active_30d),
    freeDormant: asNumber(row?.free_dormant),
  };
}

export async function loadSalesAttributionSources(
  tx: TenantTx,
): Promise<SalesAttributionSourceRow[]> {
  const rows = await tx.$queryRaw<
    Array<{ source: string; medium: string; count: bigint; revenue_cents: bigint }>
  >`
    select
      coalesce(nullif(utm_source, ''), 'direct') as source,
      coalesce(nullif(utm_medium, ''), 'none') as medium,
      count(*)::bigint as count,
      coalesce(sum(coalesce(revenue_cents, 0)), 0)::bigint as revenue_cents
    from sales_attribution_events
    group by 1, 2
    order by revenue_cents desc, count desc
    limit 100
  `;
  return rows.map((row) => ({
    source: row.source,
    medium: row.medium,
    count: asNumber(row.count),
    revenueCents: asNumber(row.revenue_cents),
  }));
}

export async function getLiveSessionAggregates(tx: TenantTx) {
  const rows = await tx.$queryRaw<
    Array<{ status: string; session_count: bigint; total_attended: bigint }>
  >`
    select
      ls.status,
      count(distinct ls.id) as session_count,
      count(la.id) filter (where la.status = 'attended') as total_attended
    from live_sessions ls
    left join live_attendance la on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
    group by ls.status
    order by ls.status
  `;
  return rows.map((row) => ({
    status: row.status,
    sessionCount: Number(row.session_count),
    totalAttended: Number(row.total_attended),
  }));
}

export async function countLiveSessionsTotal(tx: TenantTx): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
    select count(*) as count from live_sessions
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function countMessengerMessagesByDay(tx: TenantTx) {
  const rows = await tx.$queryRaw<Array<{ day: string; count: bigint }>>`
    select to_char(sent_at::date, 'YYYY-MM-DD') as day, count(*) as count
    from messenger_messages
    group by sent_at::date
    order by day desc
    limit 14
  `;
  return rows.map((row) => ({ day: row.day, count: Number(row.count) }));
}

export async function countMessengerMessagesTotal(tx: TenantTx): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
    select count(*) as count from messenger_messages
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function countAttributionEventsTotal(tx: TenantTx): Promise<number> {
  return countSalesEventsTotal(tx);
}

function asNumber(value: bigint | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "bigint" ? Number(value) : value;
}

export type InsightDashboardSnapshot = {
  currency: string;
  enrollmentValueCents: number;
  paidPaymentRevenueCents: number;
  paidPaymentRevenueCentsInRange: number;
  previousPaidPaymentRevenueCents: number;
  productCount: number;
  newProductCountInRange: number;
  learnerCount: number;
  newLearnerCountInRange: number;
  previousNewLearnerCount: number;
  enrollmentCount: number;
  enrollmentsInRange: number;
  previousEnrollmentsInRange: number;
  currentMau: number;
  activeUsers30d: number;
  previousActiveUsers30d: number;
  paidEnrollmentCount: number;
  freeEnrollmentCount: number;
  paymentStatusCounts: Array<{ status: string; count: number; amountCents: number }>;
  monthlyPaymentRevenue: Array<{ period: string; amountCents: number }>;
  monthlyEnrollments: Array<{ period: string; paid: number; free: number }>;
  activeUsersSpark: number[];
  topProducts: Array<{
    id: string;
    title: string;
    productType: string;
    studentCount: number;
    revenueEstimateCents: number;
  }>;
  recentFailedPayments: Array<{
    id: string;
    learnerName: string | null;
    productTitle: string | null;
    amountCents: number;
    currency: string;
    gatewayKey: string | null;
    failureReason: string | null;
    createdAt: string;
  }>;
  upcomingLiveSessions: Array<{
    id: string;
    title: string;
    status: string;
    scheduledAt: string | null;
  }>;
  pendingTasks: {
    publishReviews: number;
    moderationCases: number;
    deletionRequests: number;
    courseReviews: number;
  };
  scheduledEvents: Array<{
    id: string;
    name: string;
    status: string;
    startsAt: string;
  }>;
};

function loadPaymentBuckets(tx: TenantTx, window: InsightRangeWindow) {
  if (window.grain === "day") {
    return tx.$queryRaw<Array<{ period: string; amount_cents: bigint }>>`
      with buckets as (
        select generate_series(
          date_trunc('day', ${window.from}::timestamptz),
          date_trunc('day', ${window.to}::timestamptz),
          interval '1 day'
        ) as bucket
      )
      select
        to_char(b.bucket, 'YYYY-MM-DD') as period,
        coalesce(sum(po.amount_cents), 0)::bigint as amount_cents
      from buckets b
      left join payment_orders po
        on po.status = 'paid'
        and date_trunc('day', coalesce(po.paid_at, po.created_at)) = b.bucket
      group by b.bucket
      order by b.bucket asc
    `;
  }

  return tx.$queryRaw<Array<{ period: string; amount_cents: bigint }>>`
    with buckets as (
      select generate_series(
        date_trunc('month', ${window.from}::timestamptz),
        date_trunc('month', ${window.to}::timestamptz),
        interval '1 month'
      ) as bucket
    )
    select
      to_char(b.bucket, 'YYYY-MM-DD') as period,
      coalesce(sum(po.amount_cents), 0)::bigint as amount_cents
    from buckets b
    left join payment_orders po
      on po.status = 'paid'
      and date_trunc('month', coalesce(po.paid_at, po.created_at)) = b.bucket
    group by b.bucket
    order by b.bucket asc
  `;
}

function loadEnrollmentBuckets(tx: TenantTx, window: InsightRangeWindow) {
  if (window.grain === "day") {
    return tx.$queryRaw<Array<{ period: string; paid: bigint; free: bigint }>>`
      with course_pricing as (
        select
          c.id,
          case
            when coalesce(c.metadata_json->>'accessTier', 'FREE') = 'PAID'
              then greatest(coalesce((c.metadata_json->>'priceCents')::int, 0), 0)
            else 0
          end as price_cents
        from courses c
        where c.deleted_at is null
      ),
      buckets as (
        select generate_series(
          date_trunc('day', ${window.from}::timestamptz),
          date_trunc('day', ${window.to}::timestamptz),
          interval '1 day'
        ) as bucket
      )
      select
        to_char(b.bucket, 'YYYY-MM-DD') as period,
        coalesce(sum(case when cp.price_cents > 0 then 1 else 0 end), 0)::bigint as paid,
        coalesce(sum(case when cp.price_cents = 0 then 1 else 0 end), 0)::bigint as free
      from buckets b
      left join enrollments e
        on e.status = 'active'
        and date_trunc('day', e.enrolled_at) = b.bucket
      left join course_pricing cp on cp.id = e.course_id
      group by b.bucket
      order by b.bucket asc
    `;
  }

  return tx.$queryRaw<Array<{ period: string; paid: bigint; free: bigint }>>`
    with course_pricing as (
      select
        c.id,
        case
          when coalesce(c.metadata_json->>'accessTier', 'FREE') = 'PAID'
            then greatest(coalesce((c.metadata_json->>'priceCents')::int, 0), 0)
          else 0
        end as price_cents
      from courses c
      where c.deleted_at is null
    ),
    buckets as (
      select generate_series(
        date_trunc('month', ${window.from}::timestamptz),
        date_trunc('month', ${window.to}::timestamptz),
        interval '1 month'
      ) as bucket
    )
    select
      to_char(b.bucket, 'YYYY-MM-DD') as period,
      coalesce(sum(case when cp.price_cents > 0 then 1 else 0 end), 0)::bigint as paid,
      coalesce(sum(case when cp.price_cents = 0 then 1 else 0 end), 0)::bigint as free
    from buckets b
    left join enrollments e
      on e.status = 'active'
      and date_trunc('month', e.enrolled_at) = b.bucket
    left join course_pricing cp on cp.id = e.course_id
    group by b.bucket
    order by b.bucket asc
  `;
}

/** Commerce + ops snapshot for Insights → Dashboard (Learnyst-style overview). */
export async function loadInsightDashboardSnapshot(
  tx: TenantTx,
  range: InsightDashboardRange = "12m",
): Promise<InsightDashboardSnapshot> {
  const window = resolveInsightRangeWindow(range);

  const [
    kpiRows,
    mauRows,
    paymentStatusRows,
    monthlyPaymentRows,
    monthlyEnrollmentRows,
    rangeMetricRows,
    sparkRows,
    topProductRows,
    failedPaymentRows,
    upcomingLiveRows,
    taskRows,
    eventRows,
  ] = await Promise.all([
    tx.$queryRaw<
      Array<{
        currency: string | null;
        enrollment_value_cents: bigint;
        paid_payment_revenue_cents: bigint;
        product_count: bigint;
        learner_count: bigint;
        enrollment_count: bigint;
        paid_enrollment_count: bigint;
        free_enrollment_count: bigint;
      }>
    >`
      with course_pricing as (
        select
          c.id,
          case
            when coalesce(c.metadata_json->>'accessTier', 'FREE') = 'PAID'
              then greatest(coalesce((c.metadata_json->>'priceCents')::int, 0), 0)
            else 0
          end as price_cents,
          nullif(c.metadata_json->>'currency', '') as currency
        from courses c
        where c.deleted_at is null
      )
      select
        coalesce(
          (select currency from course_pricing where currency is not null limit 1),
          (select po.currency from payment_orders po limit 1),
          'INR'
        ) as currency,
        coalesce((
          select sum(cp.price_cents)::bigint
          from enrollments e
          join course_pricing cp on cp.id = e.course_id
          where e.status = 'active'
        ), 0)::bigint as enrollment_value_cents,
        coalesce((
          select sum(po.amount_cents)::bigint
          from payment_orders po
          where po.status = 'paid'
        ), 0)::bigint as paid_payment_revenue_cents,
        (
          select count(*)::bigint from courses
          where deleted_at is null and status = 'PUBLISHED'
        ) as product_count,
        (
          select count(*)::bigint from memberships
          where status = 'ACTIVE' and archived_at is null
        ) as learner_count,
        (
          select count(*)::bigint from enrollments where status = 'active'
        ) as enrollment_count,
        (
          select count(*)::bigint
          from enrollments e
          join course_pricing cp on cp.id = e.course_id
          where e.status = 'active' and cp.price_cents > 0
        ) as paid_enrollment_count,
        (
          select count(*)::bigint
          from enrollments e
          join course_pricing cp on cp.id = e.course_id
          where e.status = 'active' and cp.price_cents = 0
        ) as free_enrollment_count
    `,
    tx.$queryRaw<
      Array<{ current_mau: number; active_users_30d: number; previous_active_users_30d: number }>
    >`
      select
        (
          select count(*)::int
          from memberships m
          where m.status = 'ACTIVE'
            and m.last_active_at >= date_trunc('month', now())
        ) as current_mau,
        (
          select count(distinct membership_id)::int
          from tenant_active_days
          where day >= current_date - 29
        ) as active_users_30d,
        (
          select count(distinct membership_id)::int
          from tenant_active_days
          where day >= current_date - 59
            and day < current_date - 29
        ) as previous_active_users_30d
    `,
    tx.$queryRaw<Array<{ status: string; count: bigint; amount_cents: bigint }>>`
      select
        status,
        count(*)::bigint as count,
        coalesce(sum(amount_cents), 0)::bigint as amount_cents
      from payment_orders
      group by status
      order by count desc
    `,
    loadPaymentBuckets(tx, window),
    loadEnrollmentBuckets(tx, window),
    tx.$queryRaw<
      Array<{
        paid_in_range: bigint;
        paid_previous: bigint;
        enrollments_in_range: bigint;
        enrollments_previous: bigint;
        new_products: bigint;
        new_learners: bigint;
        previous_new_learners: bigint;
      }>
    >`
      select
        coalesce((
          select sum(po.amount_cents)::bigint
          from payment_orders po
          where po.status = 'paid'
            and coalesce(po.paid_at, po.created_at) >= ${window.from}::timestamptz
            and coalesce(po.paid_at, po.created_at) <= ${window.to}::timestamptz
        ), 0)::bigint as paid_in_range,
        coalesce((
          select sum(po.amount_cents)::bigint
          from payment_orders po
          where po.status = 'paid'
            and coalesce(po.paid_at, po.created_at) >= ${window.previousFrom}::timestamptz
            and coalesce(po.paid_at, po.created_at) < ${window.previousTo}::timestamptz
        ), 0)::bigint as paid_previous,
        (
          select count(*)::bigint
          from enrollments e
          where e.status = 'active'
            and e.enrolled_at >= ${window.from}::timestamptz
            and e.enrolled_at <= ${window.to}::timestamptz
        ) as enrollments_in_range,
        (
          select count(*)::bigint
          from enrollments e
          where e.status = 'active'
            and e.enrolled_at >= ${window.previousFrom}::timestamptz
            and e.enrolled_at < ${window.previousTo}::timestamptz
        ) as enrollments_previous,
        (
          select count(*)::bigint
          from courses c
          where c.deleted_at is null
            and c.status = 'PUBLISHED'
            and c.created_at >= ${window.from}::timestamptz
            and c.created_at <= ${window.to}::timestamptz
        ) as new_products,
        (
          select count(*)::bigint
          from memberships m
          where m.status = 'ACTIVE'
            and m.archived_at is null
            and m.created_at >= ${window.from}::timestamptz
            and m.created_at <= ${window.to}::timestamptz
        ) as new_learners,
        (
          select count(*)::bigint
          from memberships m
          where m.status = 'ACTIVE'
            and m.archived_at is null
            and m.created_at >= ${window.previousFrom}::timestamptz
            and m.created_at < ${window.previousTo}::timestamptz
        ) as previous_new_learners
    `,
    tx.$queryRaw<Array<{ period: string; value: number }>>`
      with days as (
        select generate_series(current_date - 29, current_date, interval '1 day') as day
      )
      select
        to_char(d.day, 'YYYY-MM-DD') as period,
        coalesce(count(distinct tad.membership_id), 0)::int as value
      from days d
      left join tenant_active_days tad on tad.day = d.day::date
      group by d.day
      order by d.day asc
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        product_type: string;
        student_count: bigint;
        revenue_estimate_cents: bigint;
      }>
    >`
      select
        c.id::text as id,
        c.title,
        coalesce(
          nullif(c.metadata_json->>'productType', ''),
          nullif(c.metadata_json->>'type', ''),
          'Course'
        ) as product_type,
        count(e.id)::bigint as student_count,
        (
          count(e.id) * case
            when coalesce(c.metadata_json->>'accessTier', 'FREE') = 'PAID'
              then greatest(coalesce((c.metadata_json->>'priceCents')::int, 0), 0)
            else 0
          end
        )::bigint as revenue_estimate_cents
      from courses c
      left join enrollments e
        on e.course_id = c.id and e.tenant_id = c.tenant_id and e.status = 'active'
      where c.deleted_at is null and c.status = 'PUBLISHED'
      group by c.id, c.title, c.metadata_json
      order by student_count desc, c.title asc
      limit 5
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        learner_name: string | null;
        product_title: string | null;
        amount_cents: number;
        currency: string;
        gateway_key: string | null;
        failure_reason: string | null;
        created_at: Date;
      }>
    >`
      select
        po.id::text as id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        po.product_title,
        po.amount_cents,
        po.currency,
        po.gateway_key,
        coalesce(
          nullif(po.metadata_json->>'failureReason', ''),
          nullif(po.metadata_json->>'failure_reason', ''),
          nullif(po.metadata_json->>'errorMessage', ''),
          nullif(po.metadata_json->>'error', ''),
          nullif(po.metadata_json->>'decline_code', ''),
          'Payment declined'
        ) as failure_reason,
        po.created_at
      from payment_orders po
      left join memberships m on m.id = po.membership_id and m.tenant_id = po.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where po.status = 'failed'
      order by po.created_at desc
      limit 10
    `,
    tx.$queryRaw<Array<{ id: string; title: string; status: string; scheduled_at: Date | null }>>`
      select
        ls.id::text as id,
        ls.title,
        ls.status,
        ls.scheduled_at
      from live_sessions ls
      where ls.status in ('scheduled', 'live')
        and (
          ls.scheduled_at is null
          or ls.scheduled_at >= now() - interval '1 day'
        )
      order by ls.scheduled_at asc nulls last
      limit 8
    `,
    tx.$queryRaw<
      Array<{
        publish_reviews: bigint;
        moderation_cases: bigint;
        deletion_requests: bigint;
        course_reviews: bigint;
      }>
    >`
      select
        (
          select count(*)::bigint from courses
          where deleted_at is null and status = 'REVIEW'
        ) as publish_reviews,
        (
          select count(*)::bigint from moderation_cases
          where status in ('OPEN', 'REVIEWING')
        ) as moderation_cases,
        (
          select count(*)::bigint from deletion_requests
          where status in ('QUEUED', 'RUNNING')
        ) as deletion_requests,
        (
          select count(*)::bigint from course_reviews
          where coalesce(status, 'APPROVED') = 'PENDING'
            and created_at >= now() - interval '30 days'
        ) as course_reviews
    `,
    tx.$queryRaw<Array<{ id: string; name: string; status: string; starts_at: Date }>>`
      select id::text as id, name, status, starts_at
      from seasonal_events
      where status in ('scheduled', 'active')
        and ends_at >= now()
      order by starts_at asc
      limit 8
    `,
  ]);

  const kpi = kpiRows[0];
  const mau = mauRows[0];
  const tasks = taskRows[0];
  const rangeMetrics = rangeMetricRows[0];

  return {
    currency: kpi?.currency?.trim() || "INR",
    enrollmentValueCents: asNumber(kpi?.enrollment_value_cents),
    paidPaymentRevenueCents: asNumber(kpi?.paid_payment_revenue_cents),
    paidPaymentRevenueCentsInRange: asNumber(rangeMetrics?.paid_in_range),
    previousPaidPaymentRevenueCents: asNumber(rangeMetrics?.paid_previous),
    productCount: asNumber(kpi?.product_count),
    newProductCountInRange: asNumber(rangeMetrics?.new_products),
    learnerCount: asNumber(kpi?.learner_count),
    newLearnerCountInRange: asNumber(rangeMetrics?.new_learners),
    previousNewLearnerCount: asNumber(rangeMetrics?.previous_new_learners),
    enrollmentCount: asNumber(kpi?.enrollment_count),
    enrollmentsInRange: asNumber(rangeMetrics?.enrollments_in_range),
    previousEnrollmentsInRange: asNumber(rangeMetrics?.enrollments_previous),
    currentMau: mau?.current_mau ?? 0,
    activeUsers30d: mau?.active_users_30d ?? 0,
    previousActiveUsers30d: mau?.previous_active_users_30d ?? 0,
    paidEnrollmentCount: asNumber(kpi?.paid_enrollment_count),
    freeEnrollmentCount: asNumber(kpi?.free_enrollment_count),
    paymentStatusCounts: paymentStatusRows.map((row) => ({
      status: row.status,
      count: asNumber(row.count),
      amountCents: asNumber(row.amount_cents),
    })),
    monthlyPaymentRevenue: monthlyPaymentRows.map((row) => ({
      period: row.period,
      amountCents: asNumber(row.amount_cents),
    })),
    monthlyEnrollments: monthlyEnrollmentRows.map((row) => ({
      period: row.period,
      paid: asNumber(row.paid),
      free: asNumber(row.free),
    })),
    activeUsersSpark: sparkRows.map((row) => row.value),
    topProducts: topProductRows.map((row) => ({
      id: row.id,
      title: row.title,
      productType: row.product_type,
      studentCount: asNumber(row.student_count),
      revenueEstimateCents: asNumber(row.revenue_estimate_cents),
    })),
    recentFailedPayments: failedPaymentRows.map((row) => ({
      id: row.id,
      learnerName: row.learner_name,
      productTitle: row.product_title,
      amountCents: asNumber(row.amount_cents),
      currency: row.currency,
      gatewayKey: row.gateway_key,
      failureReason: row.failure_reason,
      createdAt:
        row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    })),
    upcomingLiveSessions: upcomingLiveRows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      scheduledAt: row.scheduled_at?.toISOString() ?? null,
    })),
    pendingTasks: {
      publishReviews: asNumber(tasks?.publish_reviews),
      moderationCases: asNumber(tasks?.moderation_cases),
      deletionRequests: asNumber(tasks?.deletion_requests),
      courseReviews: asNumber(tasks?.course_reviews),
    },
    scheduledEvents: eventRows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      startsAt: row.starts_at.toISOString(),
    })),
  };
}

/** Matches domain `TENANT_LEARNING_ROLLUP_KEYS` — keep in sync. */
export const SCHOOL_VITALS_ROLLUP_KEYS = [
  "lessons_completed",
  "assessments_submitted",
  "assessments_passed",
  "practice_sessions_completed",
  "certificates_issued",
  "community_posts_created",
  "moderation_cases_opened",
  "path_steps_completed",
] as const;

export type SchoolVitalsRollupKey = (typeof SCHOOL_VITALS_ROLLUP_KEYS)[number];

export type LearningRollupBundle = {
  from: string;
  to: string;
  totals: Record<SchoolVitalsRollupKey, number>;
  seriesByKey: Record<SchoolVitalsRollupKey, Array<{ period: string; value: number }>>;
  activitySeries: Array<{ period: string; value: number }>;
};

export type SchoolVitalsSnapshot = {
  learnerCount: number;
  enrollmentCount: number;
  currentMau: number;
  activeUsers30d: number;
  inactiveLearnerCount: number;
  dormantCourseCount: number;
  openModerationCases: number;
  upcomingLiveCount: number;
  dailyActiveUsers: Array<{ period: string; value: number }>;
  topCourses: Array<{
    id: string;
    title: string;
    completions30d: number;
    activeLearners: number;
    avgProgressPct: number;
  }>;
};

function emptyLearningTotals(): Record<SchoolVitalsRollupKey, number> {
  return {
    lessons_completed: 0,
    assessments_submitted: 0,
    assessments_passed: 0,
    practice_sessions_completed: 0,
    certificates_issued: 0,
    community_posts_created: 0,
    moderation_cases_opened: 0,
    path_steps_completed: 0,
  };
}

function emptyLearningSeries(): Record<
  SchoolVitalsRollupKey,
  Array<{ period: string; value: number }>
> {
  return {
    lessons_completed: [],
    assessments_submitted: [],
    assessments_passed: [],
    practice_sessions_completed: [],
    certificates_issued: [],
    community_posts_created: [],
    moderation_cases_opened: [],
    path_steps_completed: [],
  };
}

/**
 * Aggregated tenant.learning rollups for Insights (avoids dashboard query pagination limits).
 * Default window: last 30 UTC days inclusive.
 */
export async function loadLearningRollupBundle(
  tx: TenantTx,
  rangeDays = 30,
): Promise<LearningRollupBundle> {
  const keys = [...SCHOOL_VITALS_ROLLUP_KEYS];
  const span = Math.max(1, Math.min(rangeDays, 366));

  const [boundRows, totalRows, seriesRows] = await Promise.all([
    tx.$queryRaw<Array<{ from_day: Date; to_day: Date }>>`
      select
        (current_date - (${span}::int - 1))::timestamptz as from_day,
        current_date::timestamptz as to_day
    `,
    tx.$queryRaw<Array<{ rollup_key: string; total: bigint }>>`
      select
        ar.rollup_key,
        coalesce(sum(coalesce((ar.metrics_json->>'count')::int, 0)), 0)::bigint as total
      from analytics_rollups ar
      where ar.tenant_id = current_setting('app.tenant_id')::uuid
        and ar.subject_type = 'tenant'
        and ar.subject_id = current_setting('app.tenant_id')
        and ar.rollup_key = any(${keys}::text[])
        and ar.period_start >= (current_date - (${span}::int - 1))::timestamptz
        and ar.period_start < (current_date + 1)::timestamptz
      group by ar.rollup_key
    `,
    tx.$queryRaw<Array<{ period: string; rollup_key: string; value: bigint }>>`
      select
        to_char(ar.period_start::date, 'YYYY-MM-DD') as period,
        ar.rollup_key,
        coalesce(sum(coalesce((ar.metrics_json->>'count')::int, 0)), 0)::bigint as value
      from analytics_rollups ar
      where ar.tenant_id = current_setting('app.tenant_id')::uuid
        and ar.subject_type = 'tenant'
        and ar.subject_id = current_setting('app.tenant_id')
        and ar.rollup_key = any(${keys}::text[])
        and ar.period_start >= (current_date - (${span}::int - 1))::timestamptz
        and ar.period_start < (current_date + 1)::timestamptz
      group by ar.period_start::date, ar.rollup_key
      order by ar.period_start::date asc, ar.rollup_key asc
    `,
  ]);

  const totals = emptyLearningTotals();
  for (const row of totalRows) {
    if ((keys as string[]).includes(row.rollup_key)) {
      totals[row.rollup_key as SchoolVitalsRollupKey] = asNumber(row.total);
    }
  }

  const seriesByKey = emptyLearningSeries();
  const activityByPeriod = new Map<string, number>();
  for (const row of seriesRows) {
    if ((keys as string[]).includes(row.rollup_key)) {
      const value = asNumber(row.value);
      seriesByKey[row.rollup_key as SchoolVitalsRollupKey].push({
        period: row.period,
        value,
      });
      activityByPeriod.set(row.period, (activityByPeriod.get(row.period) ?? 0) + value);
    }
  }

  const bound = boundRows[0];
  const from =
    bound?.from_day instanceof Date
      ? bound.from_day.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const to = bound?.to_day instanceof Date ? bound.to_day.toISOString().slice(0, 10) : from;

  return {
    from,
    to,
    totals,
    seriesByKey,
    activitySeries: [...activityByPeriod.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, value]) => ({ period, value })),
  };
}

/** Engagement + content health snapshot for Insights → School Vitals. */
export async function loadSchoolVitalsSnapshot(
  tx: TenantTx,
  rangeDays = 30,
): Promise<SchoolVitalsSnapshot> {
  const span = Math.max(1, Math.min(rangeDays, 366));
  const [kpiRows, healthRows, dailyActiveRows, topCourseRows] = await Promise.all([
    tx.$queryRaw<
      Array<{
        learner_count: bigint;
        enrollment_count: bigint;
        current_mau: number;
        active_users_30d: number;
      }>
    >`
      select
        (
          select count(*)::bigint from memberships
          where status = 'ACTIVE' and archived_at is null
        ) as learner_count,
        (
          select count(*)::bigint from enrollments where status = 'active'
        ) as enrollment_count,
        (
          select count(*)::int
          from memberships m
          where m.status = 'ACTIVE'
            and m.last_active_at >= date_trunc('month', now())
        ) as current_mau,
        (
          select count(distinct membership_id)::int
          from tenant_active_days
          where day >= current_date - 29
        ) as active_users_30d
    `,
    tx.$queryRaw<
      Array<{
        inactive_learner_count: number;
        dormant_course_count: number;
        open_moderation_cases: number;
        upcoming_live_count: number;
      }>
    >`
      with course_activity as (
        select
          c.id as course_id,
          max(lp.last_seen_at) as last_activity_at
        from courses c
        left join course_modules cm
          on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
        left join lessons l
          on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
        left join lesson_progress lp
          on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
        where c.deleted_at is null
          and c.status = 'PUBLISHED'
        group by c.id
      )
      select
        (
          select count(distinct m.id)::int
          from memberships m
          join user_roles ur on ur.membership_id = m.id and ur.tenant_id = m.tenant_id
          join roles r on r.id = ur.role_id and r.tenant_id = m.tenant_id and r.key = 'learner'
          where m.status = 'ACTIVE'
            and m.archived_at is null
            and (m.last_active_at is null or m.last_active_at < now() - interval '30 days')
        ) as inactive_learner_count,
        (
          select count(*)::int
          from course_activity
          where last_activity_at is null
             or last_activity_at < now() - interval '30 days'
        ) as dormant_course_count,
        (
          select count(*)::int from moderation_cases
          where status in ('OPEN', 'REVIEWING')
        ) as open_moderation_cases,
        (
          select count(*)::int
          from live_sessions ls
          where ls.status in ('scheduled', 'live')
            and (
              ls.scheduled_at is null
              or ls.scheduled_at >= now() - interval '1 day'
            )
        ) as upcoming_live_count
    `,
    tx.$queryRaw<Array<{ period: string; value: number }>>`
      with days as (
        select generate_series(
          current_date - (${span}::int - 1),
          current_date,
          interval '1 day'
        )::date as day
      )
      select
        to_char(d.day, 'YYYY-MM-DD') as period,
        coalesce(count(distinct tad.membership_id), 0)::int as value
      from days d
      left join tenant_active_days tad on tad.day = d.day
      group by d.day
      order by d.day asc
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        completions_30d: bigint;
        active_learners: bigint;
        avg_progress_pct: number;
      }>
    >`
      select
        c.id::text as id,
        c.title,
        count(lp.id) filter (
          where lp.completed_at is not null
            and lp.completed_at >= (current_date - (${span}::int - 1))::timestamptz
        )::bigint as completions_30d,
        count(distinct lp.membership_id) filter (
          where lp.last_seen_at is not null
            and lp.last_seen_at >= (current_date - (${span}::int - 1))::timestamptz
        )::bigint as active_learners,
        coalesce(avg(lp.progress_pct) filter (
          where lp.last_seen_at is not null
            and lp.last_seen_at >= (current_date - (${span}::int - 1))::timestamptz
        ), 0)::float8 as avg_progress_pct
      from courses c
      join course_modules cm
        on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
      join lessons l
        on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
      left join lesson_progress lp
        on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
      where c.deleted_at is null
        and c.status = 'PUBLISHED'
      group by c.id, c.title
      having
        count(lp.id) filter (
          where lp.completed_at is not null
            and lp.completed_at >= (current_date - (${span}::int - 1))::timestamptz
        ) > 0
        or count(distinct lp.membership_id) filter (
          where lp.last_seen_at is not null
            and lp.last_seen_at >= (current_date - (${span}::int - 1))::timestamptz
        ) > 0
      order by completions_30d desc, active_learners desc, c.title asc
      limit 8
    `,
  ]);

  const kpi = kpiRows[0];
  const health = healthRows[0];

  return {
    learnerCount: asNumber(kpi?.learner_count),
    enrollmentCount: asNumber(kpi?.enrollment_count),
    currentMau: kpi?.current_mau ?? 0,
    activeUsers30d: kpi?.active_users_30d ?? 0,
    inactiveLearnerCount: health?.inactive_learner_count ?? 0,
    dormantCourseCount: health?.dormant_course_count ?? 0,
    openModerationCases: health?.open_moderation_cases ?? 0,
    upcomingLiveCount: health?.upcoming_live_count ?? 0,
    dailyActiveUsers: dailyActiveRows.map((row) => ({
      period: row.period,
      value: row.value,
    })),
    topCourses: topCourseRows.map((row) => ({
      id: row.id,
      title: row.title,
      completions30d: asNumber(row.completions_30d),
      activeLearners: asNumber(row.active_learners),
      avgProgressPct: Math.round(row.avg_progress_pct || 0),
    })),
  };
}

export type ContentHealthSession = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  registeredCount: number;
};

export type ContentHealthDetail = {
  dormantLessonCount: number;
  neverActiveLearnerCount: number;
  inactivePaidCount: number;
  inactiveEnrollmentCount: number;
  moderationOldestOpenDays: number | null;
  moderationOver72hCount: number;
  moderationReviewingCount: number;
  liveNowCount: number;
  upcomingRegisteredCount: number;
  upcomingSessions: ContentHealthSession[];
};

export async function loadContentHealthDetail(tx: TenantTx): Promise<ContentHealthDetail> {
  const [extraRows, sessionRows] = await Promise.all([
    tx.$queryRaw<
      Array<{
        dormant_lesson_count: number;
        never_active_learner_count: number;
        inactive_paid_count: number;
        inactive_enrollment_count: number;
        moderation_oldest_open_days: number | null;
        moderation_over_72h_count: number;
        moderation_reviewing_count: number;
        live_now_count: number;
        upcoming_registered_count: number;
      }>
    >`
      with course_activity as (
        select
          c.id as course_id,
          max(lp.last_seen_at) as last_activity_at
        from courses c
        left join course_modules cm
          on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
        left join lessons l
          on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
        left join lesson_progress lp
          on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
        where c.deleted_at is null
          and c.status = 'PUBLISHED'
        group by c.id
      ),
      dormant as (
        select course_id
        from course_activity
        where last_activity_at is null
           or last_activity_at < now() - interval '30 days'
      ),
      inactive as (
        select m.id, m.last_active_at
        from memberships m
        join user_roles ur on ur.membership_id = m.id and ur.tenant_id = m.tenant_id
        join roles r on r.id = ur.role_id and r.tenant_id = m.tenant_id and r.key = 'learner'
        where m.status = 'ACTIVE'
          and m.archived_at is null
          and (m.last_active_at is null or m.last_active_at < now() - interval '30 days')
      )
      select
        (
          select count(l.id)::int
          from dormant d
          join course_modules cm
            on cm.course_id = d.course_id and cm.deleted_at is null
          join lessons l
            on l.module_id = cm.id and l.deleted_at is null
        ) as dormant_lesson_count,
        (
          select count(*)::int from inactive where last_active_at is null
        ) as never_active_learner_count,
        (
          select count(distinct i.id)::int
          from inactive i
          join enrollments e on e.membership_id = i.id and e.status = 'active' and e.enrolled_type = 'paid'
        ) as inactive_paid_count,
        (
          select count(e.id)::int
          from inactive i
          join enrollments e on e.membership_id = i.id and e.status = 'active'
        ) as inactive_enrollment_count,
        (
          select
            case
              when min(mc.created_at) is null then null
              else greatest(0, floor(extract(epoch from (now() - min(mc.created_at))) / 86400))::int
            end
          from moderation_cases mc
          where mc.status in ('OPEN', 'REVIEWING')
        ) as moderation_oldest_open_days,
        (
          select count(*)::int
          from moderation_cases
          where status in ('OPEN', 'REVIEWING')
            and created_at < now() - interval '72 hours'
        ) as moderation_over_72h_count,
        (
          select count(*)::int from moderation_cases where status = 'REVIEWING'
        ) as moderation_reviewing_count,
        (
          select count(*)::int from live_sessions where status = 'live'
        ) as live_now_count,
        (
          select count(la.id)::int
          from live_sessions ls
          join live_attendance la
            on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          where ls.status in ('scheduled', 'live')
            and (
              ls.scheduled_at is null
              or ls.scheduled_at >= now() - interval '1 day'
            )
            and la.status in ('registered', 'attended', 'absent')
        ) as upcoming_registered_count
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        status: string;
        scheduled_at: Date | null;
        registered_count: bigint;
      }>
    >`
      select
        ls.id::text as id,
        ls.title,
        ls.status,
        ls.scheduled_at,
        (
          select count(*)::bigint
          from live_attendance la
          where la.live_session_id = ls.id
            and la.tenant_id = ls.tenant_id
            and la.status in ('registered', 'attended', 'absent')
        ) as registered_count
      from live_sessions ls
      where ls.status in ('scheduled', 'live')
        and (
          ls.scheduled_at is null
          or ls.scheduled_at >= now() - interval '1 day'
        )
      order by
        case when ls.status = 'live' then 0 else 1 end,
        ls.scheduled_at asc nulls last
      limit 8
    `,
  ]);

  const extra = extraRows[0];
  return {
    dormantLessonCount: extra?.dormant_lesson_count ?? 0,
    neverActiveLearnerCount: extra?.never_active_learner_count ?? 0,
    inactivePaidCount: extra?.inactive_paid_count ?? 0,
    inactiveEnrollmentCount: extra?.inactive_enrollment_count ?? 0,
    moderationOldestOpenDays: extra?.moderation_oldest_open_days ?? null,
    moderationOver72hCount: extra?.moderation_over_72h_count ?? 0,
    moderationReviewingCount: extra?.moderation_reviewing_count ?? 0,
    liveNowCount: extra?.live_now_count ?? 0,
    upcomingRegisteredCount: extra?.upcoming_registered_count ?? 0,
    upcomingSessions: sessionRows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      scheduledAt: row.scheduled_at instanceof Date ? row.scheduled_at.toISOString() : null,
      registeredCount: asNumber(row.registered_count),
    })),
  };
}

export type SalesInsightSnapshot = {
  currency: string;
  revenueCents: number;
  revenue30dCents: number;
  paidOrderCount: number;
  failedOrderCount: number;
  pendingOrderCount: number;
  productCount: number;
  learnerCount: number;
  paidEnrollmentCount: number;
  freeEnrollmentCount: number;
  trialEnrollmentCount: number;
  offlineEnrollmentCount: number;
  onlineEnrollmentCount: number;
  enrollments30d: number;
  paidEnrollments30d: number;
  attributionTotal: number;
  pipeline: {
    visited: number;
    startedDiagnostic: number;
    enrolled: number;
  };
  pipeline30d: {
    visited: number;
    startedDiagnostic: number;
    enrolled: number;
  };
  attributionRevenueCents: number;
  monthlyPaymentRevenue: Array<{ period: string; amountCents: number }>;
  enrollmentChannel: Array<{ label: string; count: number }>;
  topProducts: Array<{
    id: string;
    title: string;
    studentCount: number;
    paidCount: number;
    trialCount: number;
    revenueEstimateCents: number;
  }>;
  topSources: Array<{ source: string; count: number; revenueCents: number }>;
  recentFailedPayments: Array<{
    id: string;
    learnerName: string | null;
    productTitle: string | null;
    amountCents: number;
    currency: string;
    gatewayKey: string | null;
    failureReason: string | null;
    createdAt: string;
  }>;
  paymentStatusCounts: Array<{ status: string; count: number; amountCents: number }>;
};

/** Commerce conversion snapshot for Insights → Sales Insight (Learnyst-style). */
export async function loadSalesInsightSnapshot(tx: TenantTx): Promise<SalesInsightSnapshot> {
  const [
    kpiRows,
    pipelineAllRows,
    pipeline30dRows,
    monthlyPaymentRows,
    channelRows,
    topProductRows,
    sourceRows,
    failedPaymentRows,
    paymentStatusRows,
  ] = await Promise.all([
    tx.$queryRaw<
      Array<{
        currency: string | null;
        revenue_cents: bigint;
        revenue_30d_cents: bigint;
        paid_order_count: bigint;
        failed_order_count: bigint;
        pending_order_count: bigint;
        product_count: bigint;
        learner_count: bigint;
        paid_enrollment_count: bigint;
        free_enrollment_count: bigint;
        trial_enrollment_count: bigint;
        offline_enrollment_count: bigint;
        online_enrollment_count: bigint;
        enrollments_30d: bigint;
        paid_enrollments_30d: bigint;
        attribution_total: bigint;
        attribution_revenue_cents: bigint;
      }>
    >`
      select
        coalesce(
          (select nullif(po.currency, '') from payment_orders po where po.status = 'paid' limit 1),
          (select nullif(c.metadata_json->>'currency', '') from courses c where c.deleted_at is null limit 1),
          'INR'
        ) as currency,
        coalesce((
          select sum(po.amount_cents)::bigint from payment_orders po where po.status = 'paid'
        ), 0)::bigint as revenue_cents,
        coalesce((
          select sum(po.amount_cents)::bigint
          from payment_orders po
          where po.status = 'paid'
            and coalesce(po.paid_at, po.created_at) >= now() - interval '30 days'
        ), 0)::bigint as revenue_30d_cents,
        (
          select count(*)::bigint from payment_orders where status = 'paid'
        ) as paid_order_count,
        (
          select count(*)::bigint from payment_orders where status = 'failed'
        ) as failed_order_count,
        (
          select count(*)::bigint
          from payment_orders
          where status in ('pending', 'created', 'requires_action', 'processing')
        ) as pending_order_count,
        (
          select count(*)::bigint from courses
          where deleted_at is null and status = 'PUBLISHED'
        ) as product_count,
        (
          select count(*)::bigint from memberships
          where status = 'ACTIVE' and archived_at is null
        ) as learner_count,
        (
          select count(*)::bigint from enrollments
          where status = 'active' and enrolled_type = 'paid'
        ) as paid_enrollment_count,
        (
          select count(*)::bigint from enrollments
          where status = 'active' and enrolled_type = 'free'
        ) as free_enrollment_count,
        (
          select count(*)::bigint from enrollments
          where status = 'active' and enrolled_type = 'trial'
        ) as trial_enrollment_count,
        (
          select count(*)::bigint from enrollments
          where status = 'active' and enrolled_type in ('offline', 'manual', 'complimentary')
        ) as offline_enrollment_count,
        (
          select count(*)::bigint from enrollments
          where status = 'active' and enrolled_type in ('paid', 'free', 'trial')
        ) as online_enrollment_count,
        (
          select count(*)::bigint from enrollments
          where enrolled_at >= now() - interval '30 days'
        ) as enrollments_30d,
        (
          select count(*)::bigint from enrollments
          where enrolled_type = 'paid' and enrolled_at >= now() - interval '30 days'
        ) as paid_enrollments_30d,
        (
          select count(*)::bigint from sales_attribution_events
        ) as attribution_total,
        coalesce((
          select sum(coalesce(revenue_cents, 0))::bigint from sales_attribution_events
        ), 0)::bigint as attribution_revenue_cents
    `,
    tx.$queryRaw<Array<{ event_type: string; count: bigint }>>`
      select event_type, count(*)::bigint as count
      from sales_attribution_events
      where event_type in ('visited', 'started_diagnostic', 'enrolled')
      group by event_type
    `,
    tx.$queryRaw<Array<{ event_type: string; count: bigint }>>`
      select event_type, count(*)::bigint as count
      from sales_attribution_events
      where event_type in ('visited', 'started_diagnostic', 'enrolled')
        and occurred_at >= now() - interval '30 days'
      group by event_type
    `,
    tx.$queryRaw<Array<{ period: string; amount_cents: bigint }>>`
      with months as (
        select generate_series(
          date_trunc('month', now()) - interval '11 months',
          date_trunc('month', now()),
          interval '1 month'
        ) as month
      )
      select
        to_char(m.month, 'YYYY-MM-DD') as period,
        coalesce(sum(po.amount_cents), 0)::bigint as amount_cents
      from months m
      left join payment_orders po
        on po.status = 'paid'
        and date_trunc('month', coalesce(po.paid_at, po.created_at)) = m.month
      group by m.month
      order by m.month asc
    `,
    tx.$queryRaw<Array<{ label: string; count: bigint }>>`
      select
        case
          when enrolled_type in ('offline', 'manual', 'complimentary') then 'Offline / manual'
          when enrolled_type = 'paid' then 'Online paid'
          when enrolled_type = 'trial' then 'Trial'
          when enrolled_type = 'free' then 'Free'
          else coalesce(enrolled_type, 'other')
        end as label,
        count(*)::bigint as count
      from enrollments
      where status = 'active'
      group by 1
      order by count desc
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        student_count: bigint;
        paid_count: bigint;
        trial_count: bigint;
        revenue_estimate_cents: bigint;
      }>
    >`
      select
        c.id::text as id,
        c.title,
        count(e.id) filter (where e.status = 'active')::bigint as student_count,
        count(e.id) filter (where e.status = 'active' and e.enrolled_type = 'paid')::bigint as paid_count,
        count(e.id) filter (where e.status = 'active' and e.enrolled_type = 'trial')::bigint as trial_count,
        coalesce((
          select sum(po.amount_cents)::bigint
          from payment_orders po
          where po.status = 'paid'
            and (
              po.product_title = c.title
              or po.metadata_json->>'courseId' = c.id::text
            )
        ), (
          count(e.id) filter (where e.status = 'active' and e.enrolled_type = 'paid')
          * case
              when coalesce(c.metadata_json->>'accessTier', 'FREE') = 'PAID'
                then greatest(coalesce((c.metadata_json->>'priceCents')::int, 0), 0)
              else 0
            end
        ))::bigint as revenue_estimate_cents
      from courses c
      left join enrollments e on e.course_id = c.id and e.tenant_id = c.tenant_id
      where c.deleted_at is null and c.status = 'PUBLISHED'
      group by c.id, c.title, c.metadata_json
      order by revenue_estimate_cents desc, paid_count desc, student_count desc, c.title asc
      limit 8
    `,
    tx.$queryRaw<Array<{ source: string; count: bigint; revenue_cents: bigint }>>`
      select
        coalesce(nullif(utm_source, ''), 'direct') as source,
        count(*)::bigint as count,
        coalesce(sum(coalesce(revenue_cents, 0)), 0)::bigint as revenue_cents
      from sales_attribution_events
      group by coalesce(nullif(utm_source, ''), 'direct')
      order by count desc, revenue_cents desc
      limit 8
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        learner_name: string | null;
        product_title: string | null;
        amount_cents: number;
        currency: string;
        gateway_key: string | null;
        failure_reason: string | null;
        created_at: Date;
      }>
    >`
      select
        po.id::text as id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        po.product_title,
        po.amount_cents,
        po.currency,
        po.gateway_key,
        coalesce(
          nullif(po.metadata_json->>'failureReason', ''),
          nullif(po.metadata_json->>'failure_reason', ''),
          nullif(po.metadata_json->>'errorMessage', ''),
          nullif(po.metadata_json->>'error', ''),
          nullif(po.metadata_json->>'decline_code', ''),
          'Payment declined'
        ) as failure_reason,
        po.created_at
      from payment_orders po
      left join memberships m on m.id = po.membership_id and m.tenant_id = po.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where po.status = 'failed'
      order by po.created_at desc
      limit 10
    `,
    tx.$queryRaw<Array<{ status: string; count: bigint; amount_cents: bigint }>>`
      select
        status,
        count(*)::bigint as count,
        coalesce(sum(amount_cents), 0)::bigint as amount_cents
      from payment_orders
      group by status
      order by count desc
    `,
  ]);

  const kpi = kpiRows[0];

  function pipelineFrom(rows: Array<{ event_type: string; count: bigint }>) {
    return {
      visited: asNumber(rows.find((row) => row.event_type === "visited")?.count),
      startedDiagnostic: asNumber(
        rows.find((row) => row.event_type === "started_diagnostic")?.count,
      ),
      enrolled: asNumber(rows.find((row) => row.event_type === "enrolled")?.count),
    };
  }

  return {
    currency: kpi?.currency?.trim() || "INR",
    revenueCents: asNumber(kpi?.revenue_cents),
    revenue30dCents: asNumber(kpi?.revenue_30d_cents),
    paidOrderCount: asNumber(kpi?.paid_order_count),
    failedOrderCount: asNumber(kpi?.failed_order_count),
    pendingOrderCount: asNumber(kpi?.pending_order_count),
    productCount: asNumber(kpi?.product_count),
    learnerCount: asNumber(kpi?.learner_count),
    paidEnrollmentCount: asNumber(kpi?.paid_enrollment_count),
    freeEnrollmentCount: asNumber(kpi?.free_enrollment_count),
    trialEnrollmentCount: asNumber(kpi?.trial_enrollment_count),
    offlineEnrollmentCount: asNumber(kpi?.offline_enrollment_count),
    onlineEnrollmentCount: asNumber(kpi?.online_enrollment_count),
    enrollments30d: asNumber(kpi?.enrollments_30d),
    paidEnrollments30d: asNumber(kpi?.paid_enrollments_30d),
    attributionTotal: asNumber(kpi?.attribution_total),
    attributionRevenueCents: asNumber(kpi?.attribution_revenue_cents),
    pipeline: pipelineFrom(pipelineAllRows),
    pipeline30d: pipelineFrom(pipeline30dRows),
    monthlyPaymentRevenue: monthlyPaymentRows.map((row) => ({
      period: row.period,
      amountCents: asNumber(row.amount_cents),
    })),
    enrollmentChannel: channelRows.map((row) => ({
      label: row.label,
      count: asNumber(row.count),
    })),
    topProducts: topProductRows.map((row) => ({
      id: row.id,
      title: row.title,
      studentCount: asNumber(row.student_count),
      paidCount: asNumber(row.paid_count),
      trialCount: asNumber(row.trial_count),
      revenueEstimateCents: asNumber(row.revenue_estimate_cents),
    })),
    topSources: sourceRows.map((row) => ({
      source: row.source,
      count: asNumber(row.count),
      revenueCents: asNumber(row.revenue_cents),
    })),
    recentFailedPayments: failedPaymentRows.map((row) => ({
      id: row.id,
      learnerName: row.learner_name,
      productTitle: row.product_title,
      amountCents: row.amount_cents,
      currency: row.currency,
      gatewayKey: row.gateway_key,
      failureReason: row.failure_reason,
      createdAt: row.created_at.toISOString(),
    })),
    paymentStatusCounts: paymentStatusRows.map((row) => ({
      status: row.status,
      count: asNumber(row.count),
      amountCents: asNumber(row.amount_cents),
    })),
  };
}

export type LiveDashboardSnapshot = {
  sessionCount: number;
  liveNowCount: number;
  upcomingCount: number;
  endedCount: number;
  cancelledCount: number;
  totalAttended: number;
  totalRegistered: number;
  attendanceRate: number;
  avgDurationSeconds: number;
  totalWatchSeconds: number;
  sessions30d: number;
  attended30d: number;
  registered30d: number;
  attendanceRate30d: number;
  sessionsByStatus: Array<{ status: string; sessionCount: number; attendedCount: number }>;
  dailyAttendance: Array<{ period: string; attended: number; registered: number }>;
  upcomingSessions: Array<{
    id: string;
    title: string;
    status: string;
    scheduledAt: string | null;
    registeredCount: number;
  }>;
  recentSessions: Array<{
    id: string;
    title: string;
    status: string;
    scheduledAt: string | null;
    attendedCount: number;
    registeredCount: number;
    avgDurationSeconds: number;
    attendanceRate: number;
  }>;
  lowAttendanceSessions: Array<{
    id: string;
    title: string;
    attendedCount: number;
    registeredCount: number;
    attendanceRate: number;
  }>;
};

/** Live ops snapshot for Insights → Live Dashboard (Learnyst-style). */
export async function loadLiveDashboardSnapshot(tx: TenantTx): Promise<LiveDashboardSnapshot> {
  const [kpiRows, statusRows, dailyRows, upcomingRows, recentRows, lowAttendanceRows] =
    await Promise.all([
      tx.$queryRaw<
        Array<{
          session_count: bigint;
          live_now_count: bigint;
          upcoming_count: bigint;
          ended_count: bigint;
          cancelled_count: bigint;
          total_attended: bigint;
          total_registered: bigint;
          avg_duration_seconds: number | null;
          total_watch_seconds: bigint;
          sessions_30d: bigint;
          attended_30d: bigint;
          registered_30d: bigint;
        }>
      >`
        select
          (select count(*)::bigint from live_sessions) as session_count,
          (
            select count(*)::bigint from live_sessions where status = 'live'
          ) as live_now_count,
          (
            select count(*)::bigint
            from live_sessions
            where status = 'scheduled'
              and (
                scheduled_at is null
                or scheduled_at >= now() - interval '1 day'
              )
          ) as upcoming_count,
          (
            select count(*)::bigint from live_sessions where status in ('ended', 'completed')
          ) as ended_count,
          (
            select count(*)::bigint from live_sessions where status = 'cancelled'
          ) as cancelled_count,
          (
            select count(*)::bigint from live_attendance where status = 'attended'
          ) as total_attended,
          (
            select count(*)::bigint
            from live_attendance
            where status in ('registered', 'attended', 'absent')
          ) as total_registered,
          (
            select avg(duration_seconds)::float8
            from live_attendance
            where status = 'attended' and duration_seconds is not null and duration_seconds > 0
          ) as avg_duration_seconds,
          coalesce((
            select sum(coalesce(duration_seconds, 0))::bigint
            from live_attendance
            where status = 'attended'
          ), 0)::bigint as total_watch_seconds,
          (
            select count(*)::bigint
            from live_sessions
            where coalesce(started_at, scheduled_at, created_at) >= now() - interval '30 days'
          ) as sessions_30d,
          (
            select count(*)::bigint
            from live_attendance la
            join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
            where la.status = 'attended'
              and coalesce(ls.started_at, ls.scheduled_at, la.joined_at, la.created_at)
                >= now() - interval '30 days'
          ) as attended_30d,
          (
            select count(*)::bigint
            from live_attendance la
            join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
            where la.status in ('registered', 'attended', 'absent')
              and coalesce(ls.started_at, ls.scheduled_at, la.created_at)
                >= now() - interval '30 days'
          ) as registered_30d
      `,
      tx.$queryRaw<Array<{ status: string; session_count: bigint; attended_count: bigint }>>`
        select
          ls.status,
          count(distinct ls.id)::bigint as session_count,
          count(la.id) filter (where la.status = 'attended')::bigint as attended_count
        from live_sessions ls
        left join live_attendance la
          on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        group by ls.status
        order by ls.status
      `,
      tx.$queryRaw<Array<{ period: string; attended: number; registered: number }>>`
        with days as (
          select generate_series(
            current_date - 29,
            current_date,
            interval '1 day'
          )::date as day
        )
        select
          to_char(d.day, 'YYYY-MM-DD') as period,
          coalesce(count(la.id) filter (where la.status = 'attended'), 0)::int as attended,
          coalesce(
            count(la.id) filter (where la.status in ('registered', 'attended', 'absent')),
            0
          )::int as registered
        from days d
        left join live_sessions ls
          on coalesce(ls.started_at, ls.scheduled_at, ls.created_at)::date = d.day
        left join live_attendance la
          on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        group by d.day
        order by d.day asc
      `,
      tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          status: string;
          scheduled_at: Date | null;
          registered_count: bigint;
        }>
      >`
        select
          ls.id::text as id,
          ls.title,
          ls.status,
          ls.scheduled_at,
          (
            select count(*)::bigint
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and la.status in ('registered', 'attended', 'absent')
          ) as registered_count
        from live_sessions ls
        where ls.status in ('scheduled', 'live')
          and (
            ls.scheduled_at is null
            or ls.scheduled_at >= now() - interval '1 day'
          )
        order by
          case when ls.status = 'live' then 0 else 1 end,
          ls.scheduled_at asc nulls last
        limit 8
      `,
      tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          status: string;
          scheduled_at: Date | null;
          attended_count: bigint;
          registered_count: bigint;
          avg_duration_seconds: number | null;
        }>
      >`
        select
          ls.id::text as id,
          ls.title,
          ls.status,
          coalesce(ls.started_at, ls.scheduled_at) as scheduled_at,
          count(la.id) filter (where la.status = 'attended')::bigint as attended_count,
          count(la.id) filter (
            where la.status in ('registered', 'attended', 'absent')
          )::bigint as registered_count,
          avg(la.duration_seconds) filter (
            where la.status = 'attended' and la.duration_seconds is not null
          )::float8 as avg_duration_seconds
        from live_sessions ls
        left join live_attendance la
          on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        group by ls.id, ls.title, ls.status, ls.started_at, ls.scheduled_at
        order by coalesce(ls.started_at, ls.scheduled_at, ls.created_at) desc nulls last
        limit 8
      `,
      tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          attended_count: bigint;
          registered_count: bigint;
        }>
      >`
        select
          ls.id::text as id,
          ls.title,
          count(la.id) filter (where la.status = 'attended')::bigint as attended_count,
          count(la.id) filter (
            where la.status in ('registered', 'attended', 'absent')
          )::bigint as registered_count
        from live_sessions ls
        left join live_attendance la
          on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        where ls.status in ('ended', 'completed')
        group by ls.id, ls.title
        having count(la.id) filter (
          where la.status in ('registered', 'attended', 'absent')
        ) >= 3
          and (
            count(la.id) filter (where la.status = 'attended')::float8
            / nullif(
              count(la.id) filter (
                where la.status in ('registered', 'attended', 'absent')
              ),
              0
            )
          ) < 0.5
        order by (
          count(la.id) filter (where la.status = 'attended')::float8
          / nullif(
            count(la.id) filter (
              where la.status in ('registered', 'attended', 'absent')
            ),
            0
          )
        ) asc nulls last
        limit 5
      `,
    ]);

  const kpi = kpiRows[0];
  const totalAttended = asNumber(kpi?.total_attended);
  const totalRegistered = asNumber(kpi?.total_registered);
  const attended30d = asNumber(kpi?.attended_30d);
  const registered30d = asNumber(kpi?.registered_30d);

  function rate(attended: number, registered: number): number {
    if (registered <= 0) return 0;
    return Math.round((attended / registered) * 100);
  }

  function sessionRate(attended: number, registered: number): number {
    return rate(attended, registered);
  }

  return {
    sessionCount: asNumber(kpi?.session_count),
    liveNowCount: asNumber(kpi?.live_now_count),
    upcomingCount: asNumber(kpi?.upcoming_count),
    endedCount: asNumber(kpi?.ended_count),
    cancelledCount: asNumber(kpi?.cancelled_count),
    totalAttended,
    totalRegistered,
    attendanceRate: rate(totalAttended, totalRegistered),
    avgDurationSeconds: Math.round(Number(kpi?.avg_duration_seconds) || 0),
    totalWatchSeconds: asNumber(kpi?.total_watch_seconds),
    sessions30d: asNumber(kpi?.sessions_30d),
    attended30d,
    registered30d,
    attendanceRate30d: rate(attended30d, registered30d),
    sessionsByStatus: statusRows.map((row) => ({
      status: row.status,
      sessionCount: asNumber(row.session_count),
      attendedCount: asNumber(row.attended_count),
    })),
    dailyAttendance: dailyRows.map((row) => ({
      period: row.period,
      attended: row.attended,
      registered: row.registered,
    })),
    upcomingSessions: upcomingRows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      scheduledAt: row.scheduled_at?.toISOString() ?? null,
      registeredCount: asNumber(row.registered_count),
    })),
    recentSessions: recentRows.map((row) => {
      const attended = asNumber(row.attended_count);
      const registered = asNumber(row.registered_count);
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        scheduledAt: row.scheduled_at?.toISOString() ?? null,
        attendedCount: attended,
        registeredCount: registered,
        avgDurationSeconds: Math.round(Number(row.avg_duration_seconds) || 0),
        attendanceRate: sessionRate(attended, registered),
      };
    }),
    lowAttendanceSessions: lowAttendanceRows.map((row) => {
      const attended = asNumber(row.attended_count);
      const registered = asNumber(row.registered_count);
      return {
        id: row.id,
        title: row.title,
        attendedCount: attended,
        registeredCount: registered,
        attendanceRate: sessionRate(attended, registered),
      };
    }),
  };
}

export type LiveDashboardNowSessionRow = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  attendedCount: number;
  registeredCount: number;
  rosteredCount: number;
  attendanceRate: number;
  batchId: string | null;
  batchKey: string | null;
  batchName: string | null;
};

export type LiveDashboardNowSnapshot = {
  attendanceRate30d: number;
  liveSessions: LiveDashboardNowSessionRow[];
  nextUp: LiveDashboardNowSessionRow[];
  endedToday: LiveDashboardNowSessionRow[];
  endedTodayTotal: number;
  nextSession: {
    id: string;
    title: string;
    scheduledAt: string | null;
  } | null;
};

/** Point-in-time Now board for Insights → Live Dashboard → Now. */
export async function loadLiveDashboardNowSnapshot(
  tx: TenantTx,
): Promise<LiveDashboardNowSnapshot> {
  const [rateRows, liveRows, nextUpRows, endedRows, endedCountRows, nextSessionRows] =
    await Promise.all([
      tx.$queryRaw<
        Array<{
          attended_30d: bigint;
          registered_30d: bigint;
        }>
      >`
        select
          (
            select count(*)::bigint
            from live_attendance la
            join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
            where la.status = 'attended'
              and coalesce(ls.started_at, ls.scheduled_at, la.joined_at, la.created_at)
                >= now() - interval '30 days'
          ) as attended_30d,
          (
            select count(*)::bigint
            from live_attendance la
            join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
            where la.status in ('registered', 'attended', 'absent')
              and coalesce(ls.started_at, ls.scheduled_at, la.created_at)
                >= now() - interval '30 days'
          ) as registered_30d
      `,
      tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          status: string;
          scheduled_at: Date | null;
          started_at: Date | null;
          ended_at: Date | null;
          attended_count: bigint;
          registered_count: bigint;
          rostered_count: bigint;
          batch_id: string | null;
          batch_key: string | null;
          batch_name: string | null;
        }>
      >`
        select
          ls.id::text as id,
          ls.title,
          ls.status,
          ls.scheduled_at,
          ls.started_at,
          ls.ended_at,
          count(la.id) filter (where la.status = 'attended')::bigint as attended_count,
          count(la.id) filter (
            where la.status in ('registered', 'attended', 'absent')
          )::bigint as registered_count,
          coalesce(
            (
              select count(*)::bigint
              from batch_memberships bm
              where bm.batch_id = ls.batch_id
                and bm.tenant_id = ls.tenant_id
            ),
            count(la.id) filter (
              where la.status in ('registered', 'attended', 'absent')
            )
          )::bigint as rostered_count,
          ls.batch_id::text as batch_id,
          b.key as batch_key,
          b.name as batch_name
        from live_sessions ls
        left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
        left join live_attendance la
          on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        where ls.status = 'live'
        group by
          ls.id, ls.title, ls.status, ls.scheduled_at, ls.started_at, ls.ended_at,
          ls.batch_id, b.key, b.name
        order by coalesce(ls.started_at, ls.scheduled_at, ls.created_at) asc nulls last
        limit 12
      `,
      tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          status: string;
          scheduled_at: Date | null;
          started_at: Date | null;
          ended_at: Date | null;
          attended_count: bigint;
          registered_count: bigint;
          rostered_count: bigint;
          batch_id: string | null;
          batch_key: string | null;
          batch_name: string | null;
        }>
      >`
        select
          ls.id::text as id,
          ls.title,
          ls.status,
          ls.scheduled_at,
          ls.started_at,
          ls.ended_at,
          count(la.id) filter (where la.status = 'attended')::bigint as attended_count,
          count(la.id) filter (
            where la.status in ('registered', 'attended', 'absent')
          )::bigint as registered_count,
          coalesce(
            (
              select count(*)::bigint
              from batch_memberships bm
              where bm.batch_id = ls.batch_id
                and bm.tenant_id = ls.tenant_id
            ),
            count(la.id) filter (
              where la.status in ('registered', 'attended', 'absent')
            )
          )::bigint as rostered_count,
          ls.batch_id::text as batch_id,
          b.key as batch_key,
          b.name as batch_name
        from live_sessions ls
        left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
        left join live_attendance la
          on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        where ls.status = 'scheduled'
          and ls.scheduled_at is not null
          and ls.scheduled_at >= now()
          and ls.scheduled_at < now() + interval '24 hours'
        group by
          ls.id, ls.title, ls.status, ls.scheduled_at, ls.started_at, ls.ended_at,
          ls.batch_id, b.key, b.name
        order by ls.scheduled_at asc
        limit 24
      `,
      tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          status: string;
          scheduled_at: Date | null;
          started_at: Date | null;
          ended_at: Date | null;
          attended_count: bigint;
          registered_count: bigint;
          rostered_count: bigint;
          batch_id: string | null;
          batch_key: string | null;
          batch_name: string | null;
        }>
      >`
        select
          ls.id::text as id,
          ls.title,
          ls.status,
          ls.scheduled_at,
          ls.started_at,
          ls.ended_at,
          count(la.id) filter (where la.status = 'attended')::bigint as attended_count,
          count(la.id) filter (
            where la.status in ('registered', 'attended', 'absent')
          )::bigint as registered_count,
          coalesce(
            (
              select count(*)::bigint
              from batch_memberships bm
              where bm.batch_id = ls.batch_id
                and bm.tenant_id = ls.tenant_id
            ),
            count(la.id) filter (
              where la.status in ('registered', 'attended', 'absent')
            )
          )::bigint as rostered_count,
          ls.batch_id::text as batch_id,
          b.key as batch_key,
          b.name as batch_name
        from live_sessions ls
        left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
        left join live_attendance la
          on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        where ls.status in ('ended', 'completed')
          and coalesce(ls.ended_at, ls.started_at, ls.scheduled_at)::date = (now() at time zone 'utc')::date
        group by
          ls.id, ls.title, ls.status, ls.scheduled_at, ls.started_at, ls.ended_at,
          ls.batch_id, b.key, b.name
        order by coalesce(ls.ended_at, ls.started_at, ls.scheduled_at) desc nulls last
        limit 12
      `,
      tx.$queryRaw<Array<{ ended_today_total: bigint }>>`
        select count(*)::bigint as ended_today_total
        from live_sessions ls
        where ls.status in ('ended', 'completed')
          and coalesce(ls.ended_at, ls.started_at, ls.scheduled_at)::date = (now() at time zone 'utc')::date
      `,
      tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          scheduled_at: Date | null;
        }>
      >`
        select
          ls.id::text as id,
          ls.title,
          ls.scheduled_at
        from live_sessions ls
        where ls.status = 'scheduled'
          and ls.scheduled_at is not null
          and ls.scheduled_at >= now()
        order by ls.scheduled_at asc
        limit 1
      `,
    ]);

  function mapRow(row: {
    id: string;
    title: string;
    status: string;
    scheduled_at: Date | null;
    started_at: Date | null;
    ended_at: Date | null;
    attended_count: bigint;
    registered_count: bigint;
    rostered_count: bigint;
    batch_id: string | null;
    batch_key: string | null;
    batch_name: string | null;
  }): LiveDashboardNowSessionRow {
    const attended = asNumber(row.attended_count);
    const registered = asNumber(row.registered_count);
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      scheduledAt: row.scheduled_at?.toISOString() ?? null,
      startedAt: row.started_at?.toISOString() ?? null,
      endedAt: row.ended_at?.toISOString() ?? null,
      attendedCount: attended,
      registeredCount: registered,
      rosteredCount: asNumber(row.rostered_count),
      attendanceRate: registered > 0 ? Math.round((attended / registered) * 100) : 0,
      batchId: row.batch_id,
      batchKey: row.batch_key,
      batchName: row.batch_name,
    };
  }

  const rate = rateRows[0];
  const attended30d = asNumber(rate?.attended_30d);
  const registered30d = asNumber(rate?.registered_30d);
  const next = nextSessionRows[0] ?? null;

  return {
    attendanceRate30d: registered30d > 0 ? Math.round((attended30d / registered30d) * 100) : 0,
    liveSessions: liveRows.map(mapRow),
    nextUp: nextUpRows.map(mapRow),
    endedToday: endedRows.map(mapRow),
    endedTodayTotal: asNumber(endedCountRows[0]?.ended_today_total),
    nextSession: next
      ? {
          id: next.id,
          title: next.title,
          scheduledAt: next.scheduled_at?.toISOString() ?? null,
        }
      : null,
  };
}

export type LiveDashboardSessionsLedgerRow = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  attendedCount: number;
  registeredCount: number;
  rosteredCount: number;
  attendanceRate: number | null;
  avgWatchMinutes: number | null;
  durationMinutes: number | null;
  batchId: string | null;
  batchKey: string | null;
  batchName: string | null;
  courseId: string | null;
  courseSlug: string | null;
  courseTitle: string | null;
};

export type LiveDashboardSessionsSummary = {
  sessionCount: number;
  endedCount: number;
  upcomingCount: number;
  liveCount: number;
  cancelledCount: number;
  attendanceRate: number;
  below50Count: number;
  endedWithRosterCount: number;
  avgWatchMinutes: number;
  totalWatchHours: number;
};

export type LiveDashboardSessionsSnapshot = {
  days: number;
  summary: LiveDashboardSessionsSummary;
  sessions: LiveDashboardSessionsLedgerRow[];
  ratesForHistogram: number[];
};

/** Sessions ledger window for Insights → Live Dashboard → Sessions. */
export async function loadLiveDashboardSessionsSnapshot(
  tx: TenantTx,
  days = 30,
): Promise<LiveDashboardSessionsSnapshot> {
  const safeDays = Math.max(1, Math.min(366, Math.floor(days)));

  const [summaryRows, sessionRows] = await Promise.all([
    tx.$queryRaw<
      Array<{
        session_count: bigint;
        ended_count: bigint;
        upcoming_count: bigint;
        live_count: bigint;
        cancelled_count: bigint;
        total_attended: bigint;
        total_registered: bigint;
        below_50_count: bigint;
        ended_with_roster_count: bigint;
        avg_duration_seconds: number | null;
        total_watch_seconds: bigint;
      }>
    >`
      with windowed as (
        select ls.*
        from live_sessions ls
        where coalesce(ls.started_at, ls.scheduled_at, ls.created_at)
          >= now() - (${safeDays}::text || ' days')::interval
      )
      select
        (select count(*)::bigint from windowed) as session_count,
        (
          select count(*)::bigint from windowed where status in ('ended', 'completed')
        ) as ended_count,
        (
          select count(*)::bigint from windowed where status = 'scheduled'
        ) as upcoming_count,
        (
          select count(*)::bigint from windowed where status = 'live'
        ) as live_count,
        (
          select count(*)::bigint from windowed where status = 'cancelled'
        ) as cancelled_count,
        (
          select count(*)::bigint
          from live_attendance la
          join windowed ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
          where la.status = 'attended'
        ) as total_attended,
        (
          select count(*)::bigint
          from live_attendance la
          join windowed ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
          where la.status in ('registered', 'attended', 'absent')
        ) as total_registered,
        (
          select count(*)::bigint
          from windowed ls
          where ls.status in ('ended', 'completed')
            and (
              select count(*)::float8
              from live_attendance la
              where la.live_session_id = ls.id
                and la.tenant_id = ls.tenant_id
                and la.status in ('registered', 'attended', 'absent')
            ) > 0
            and (
              select count(*)::float8
              from live_attendance la
              where la.live_session_id = ls.id
                and la.tenant_id = ls.tenant_id
                and la.status = 'attended'
            ) / nullif(
              (
                select count(*)::float8
                from live_attendance la
                where la.live_session_id = ls.id
                  and la.tenant_id = ls.tenant_id
                  and la.status in ('registered', 'attended', 'absent')
              ),
              0
            ) < 0.5
        ) as below_50_count,
        (
          select count(*)::bigint
          from windowed ls
          where ls.status in ('ended', 'completed')
            and (
              select count(*)
              from live_attendance la
              where la.live_session_id = ls.id
                and la.tenant_id = ls.tenant_id
                and la.status in ('registered', 'attended', 'absent')
            ) > 0
        ) as ended_with_roster_count,
        (
          select avg(la.duration_seconds)::float8
          from live_attendance la
          join windowed ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
          where la.status = 'attended'
            and la.duration_seconds is not null
            and la.duration_seconds > 0
        ) as avg_duration_seconds,
        coalesce((
          select sum(coalesce(la.duration_seconds, 0))::bigint
          from live_attendance la
          join windowed ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
          where la.status = 'attended'
        ), 0)::bigint as total_watch_seconds
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        status: string;
        scheduled_at: Date | null;
        started_at: Date | null;
        ended_at: Date | null;
        attended_count: bigint;
        registered_count: bigint;
        rostered_count: bigint;
        avg_duration_seconds: number | null;
        batch_id: string | null;
        batch_key: string | null;
        batch_name: string | null;
        course_id: string | null;
        course_slug: string | null;
        course_title: string | null;
      }>
    >`
      select
        ls.id::text as id,
        ls.title,
        ls.status,
        ls.scheduled_at,
        ls.started_at,
        ls.ended_at,
        count(la.id) filter (where la.status = 'attended')::bigint as attended_count,
        count(la.id) filter (
          where la.status in ('registered', 'attended', 'absent')
        )::bigint as registered_count,
        coalesce(
          (
            select count(*)::bigint
            from batch_memberships bm
            where bm.batch_id = ls.batch_id
              and bm.tenant_id = ls.tenant_id
          ),
          count(la.id) filter (
            where la.status in ('registered', 'attended', 'absent')
          )
        )::bigint as rostered_count,
        avg(la.duration_seconds) filter (
          where la.status = 'attended' and la.duration_seconds is not null
        )::float8 as avg_duration_seconds,
        ls.batch_id::text as batch_id,
        b.key as batch_key,
        b.name as batch_name,
        ls.course_id::text as course_id,
        c.slug as course_slug,
        c.title as course_title
      from live_sessions ls
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id and c.deleted_at is null
      left join live_attendance la
        on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
      where coalesce(ls.started_at, ls.scheduled_at, ls.created_at)
        >= now() - (${safeDays}::text || ' days')::interval
      group by
        ls.id, ls.title, ls.status, ls.scheduled_at, ls.started_at, ls.ended_at,
        ls.batch_id, b.key, b.name, ls.course_id, c.slug, c.title
      order by coalesce(ls.scheduled_at, ls.started_at, ls.created_at) desc nulls last
      limit 500
    `,
  ]);

  const summary = summaryRows[0];
  const totalAttended = asNumber(summary?.total_attended);
  const totalRegistered = asNumber(summary?.total_registered);

  const sessions: LiveDashboardSessionsLedgerRow[] = sessionRows.map((row) => {
    const attended = asNumber(row.attended_count);
    const registered = asNumber(row.registered_count);
    const rostered = Math.max(asNumber(row.rostered_count), registered);
    const hasRoster = rostered > 0;
    const rate = hasRoster ? Math.round((attended / rostered) * 100) : null;
    const avgWatch =
      row.avg_duration_seconds != null && row.avg_duration_seconds > 0
        ? Math.round(row.avg_duration_seconds / 60)
        : null;
    let durationMinutes: number | null = null;
    if (row.started_at && row.ended_at) {
      const ms = row.ended_at.getTime() - row.started_at.getTime();
      if (ms > 0) durationMinutes = Math.round(ms / 60000);
    }

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      scheduledAt: row.scheduled_at?.toISOString() ?? null,
      startedAt: row.started_at?.toISOString() ?? null,
      endedAt: row.ended_at?.toISOString() ?? null,
      attendedCount: attended,
      registeredCount: registered,
      rosteredCount: rostered,
      attendanceRate: rate,
      avgWatchMinutes: avgWatch,
      durationMinutes,
      batchId: row.batch_id,
      batchKey: row.batch_key,
      batchName: row.batch_name,
      courseId: row.course_id,
      courseSlug: row.course_slug,
      courseTitle: row.course_title,
    };
  });

  const ratesForHistogram = sessions
    .filter(
      (session) =>
        (session.status === "ended" || session.status === "completed") &&
        session.attendanceRate != null,
    )
    .map((session) => session.attendanceRate as number);

  return {
    days: safeDays,
    summary: {
      sessionCount: asNumber(summary?.session_count),
      endedCount: asNumber(summary?.ended_count),
      upcomingCount: asNumber(summary?.upcoming_count),
      liveCount: asNumber(summary?.live_count),
      cancelledCount: asNumber(summary?.cancelled_count),
      attendanceRate: totalRegistered > 0 ? Math.round((totalAttended / totalRegistered) * 100) : 0,
      below50Count: asNumber(summary?.below_50_count),
      endedWithRosterCount: asNumber(summary?.ended_with_roster_count),
      avgWatchMinutes: Math.round((summary?.avg_duration_seconds ?? 0) / 60),
      totalWatchHours: Math.round((asNumber(summary?.total_watch_seconds) / 3600) * 10) / 10,
    },
    sessions,
    ratesForHistogram,
  };
}

export type LiveDashboardAttendanceDay = {
  period: string;
  attended: number;
  registered: number;
  sessionCount: number;
  weekday: number;
};

export type LiveDashboardAttendanceSessionGap = {
  id: string;
  title: string;
  attendedCount: number;
  registeredCount: number;
  rosteredCount: number;
  batchId: string | null;
};

export type LiveDashboardAttendanceSnapshot = {
  days: number;
  daily: LiveDashboardAttendanceDay[];
  topGapSessions: LiveDashboardAttendanceSessionGap[];
  scatterSessions: Array<{
    id: string;
    title: string;
    rosteredCount: number;
    attendanceRate: number;
    batchId: string | null;
  }>;
};

/** Attendance overview window for Insights → Live Dashboard → Attendance. */
export async function loadLiveDashboardAttendanceSnapshot(
  tx: TenantTx,
  days = 30,
): Promise<LiveDashboardAttendanceSnapshot> {
  const safeDays = Math.max(1, Math.min(90, Math.floor(days)));

  const [dailyRows, gapRows, scatterRows] = await Promise.all([
    tx.$queryRaw<
      Array<{
        period: string;
        attended: number;
        registered: number;
        session_count: number;
        weekday: number;
      }>
    >`
      with days as (
        select generate_series(
          current_date - (${safeDays}::int - 1),
          current_date,
          interval '1 day'
        )::date as day
      )
      select
        to_char(d.day, 'YYYY-MM-DD') as period,
        coalesce(count(la.id) filter (where la.status = 'attended'), 0)::int as attended,
        coalesce(
          count(la.id) filter (where la.status in ('registered', 'attended', 'absent')),
          0
        )::int as registered,
        coalesce(count(distinct ls.id), 0)::int as session_count,
        extract(isodow from d.day)::int as weekday
      from days d
      left join live_sessions ls
        on coalesce(ls.started_at, ls.scheduled_at, ls.created_at)::date = d.day
      left join live_attendance la
        on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
      group by d.day
      order by d.day asc
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        attended_count: bigint;
        registered_count: bigint;
        rostered_count: bigint;
        batch_id: string | null;
      }>
    >`
      select
        ls.id::text as id,
        ls.title,
        count(la.id) filter (where la.status = 'attended')::bigint as attended_count,
        count(la.id) filter (
          where la.status in ('registered', 'attended', 'absent')
        )::bigint as registered_count,
        coalesce(
          (
            select count(*)::bigint
            from batch_memberships bm
            where bm.batch_id = ls.batch_id
              and bm.tenant_id = ls.tenant_id
          ),
          count(la.id) filter (
            where la.status in ('registered', 'attended', 'absent')
          )
        )::bigint as rostered_count,
        ls.batch_id::text as batch_id
      from live_sessions ls
      left join live_attendance la
        on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
      where ls.status in ('ended', 'completed')
        and coalesce(ls.started_at, ls.scheduled_at, ls.created_at)
          >= now() - (${safeDays}::text || ' days')::interval
      group by ls.id, ls.title, ls.batch_id
      having count(la.id) filter (
        where la.status in ('registered', 'attended', 'absent')
      ) > 0
      order by (
        count(la.id) filter (
          where la.status in ('registered', 'attended', 'absent')
        ) - count(la.id) filter (where la.status = 'attended')
      ) desc
      limit 8
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        rostered_count: bigint;
        attended_count: bigint;
        batch_id: string | null;
      }>
    >`
      select
        ls.id::text as id,
        ls.title,
        coalesce(
          (
            select count(*)::bigint
            from batch_memberships bm
            where bm.batch_id = ls.batch_id
              and bm.tenant_id = ls.tenant_id
          ),
          count(la.id) filter (
            where la.status in ('registered', 'attended', 'absent')
          )
        )::bigint as rostered_count,
        count(la.id) filter (where la.status = 'attended')::bigint as attended_count,
        ls.batch_id::text as batch_id
      from live_sessions ls
      left join live_attendance la
        on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
      where ls.status in ('ended', 'completed', 'live')
        and coalesce(ls.started_at, ls.scheduled_at, ls.created_at)
          >= now() - (${safeDays}::text || ' days')::interval
      group by ls.id, ls.title, ls.batch_id
      having coalesce(
        (
          select count(*)::bigint
          from batch_memberships bm
          where bm.batch_id = ls.batch_id
            and bm.tenant_id = ls.tenant_id
        ),
        count(la.id) filter (
          where la.status in ('registered', 'attended', 'absent')
        )
      ) > 0
      order by coalesce(ls.started_at, ls.scheduled_at, ls.created_at) desc nulls last
      limit 40
    `,
  ]);

  return {
    days: safeDays,
    daily: dailyRows.map((row) => ({
      period: row.period,
      attended: row.attended,
      registered: row.registered,
      sessionCount: row.session_count,
      weekday: row.weekday,
    })),
    topGapSessions: gapRows.map((row) => ({
      id: row.id,
      title: row.title,
      attendedCount: asNumber(row.attended_count),
      registeredCount: asNumber(row.registered_count),
      rosteredCount: Math.max(asNumber(row.rostered_count), asNumber(row.registered_count)),
      batchId: row.batch_id,
    })),
    scatterSessions: scatterRows.map((row) => {
      const rostered = asNumber(row.rostered_count);
      const attended = asNumber(row.attended_count);
      return {
        id: row.id,
        title: row.title,
        rosteredCount: rostered,
        attendanceRate: rostered > 0 ? Math.round((attended / rostered) * 100) : 0,
        batchId: row.batch_id,
      };
    }),
  };
}

export type MarketingInsightSnapshot = {
  attributionTotal: number;
  attribution30d: number;
  attributionRevenueCents: number;
  formCount: number;
  liveFormCount: number;
  submissionCount: number;
  submissions30d: number;
  contactCount: number;
  contacts30d: number;
  ctaCount: number;
  liveCtaCount: number;
  ctaViews: number;
  ctaClicks: number;
  workflowCount: number;
  publishedWorkflowCount: number;
  workflowRunsTotal: number;
  workflowRuns30d: number;
  workflowRunsCompleted: number;
  workflowRunsFailed: number;
  campaignCount: number;
  launchedCampaignCount: number;
  emailCampaignSent: number;
  emailRecipients: number;
  activeCouponCount: number;
  couponRedemptions: number;
  couponRedemptions30d: number;
  couponDiscountCents: number;
  eventCount: number;
  eventRegistrations: number;
  eventRegistrations30d: number;
  bySource: Array<{ source: string; count: number; revenueCents: number }>;
  byMedium: Array<{ medium: string; count: number }>;
  byCampaign: Array<{ campaign: string; count: number; revenueCents: number }>;
  dailyLeads: Array<{ period: string; submissions: number; contacts: number }>;
  topForms: Array<{ id: string; title: string; status: string; submissions: number }>;
  topCtas: Array<{
    id: string;
    title: string;
    ctaType: string;
    status: string;
    views: number;
    clicks: number;
  }>;
  topCoupons: Array<{
    id: string;
    code: string;
    name: string;
    redemptions: number;
    discountCents: number;
  }>;
  recentWorkflowRuns: Array<{
    id: string;
    workflowTitle: string;
    status: string;
    triggerEventType: string;
    createdAt: string;
  }>;
};

/** Lead-gen + channel snapshot for Insights → Marketing Insight (Learnyst-style). */
export async function loadMarketingInsightSnapshot(
  tx: TenantTx,
): Promise<MarketingInsightSnapshot> {
  const [
    kpiRows,
    sourceRows,
    mediumRows,
    campaignRows,
    dailyLeadRows,
    topFormRows,
    topCtaRows,
    topCouponRows,
    recentRunRows,
  ] = await Promise.all([
    tx.$queryRaw<
      Array<{
        attribution_total: bigint;
        attribution_30d: bigint;
        attribution_revenue_cents: bigint;
        form_count: bigint;
        live_form_count: bigint;
        submission_count: bigint;
        submissions_30d: bigint;
        contact_count: bigint;
        contacts_30d: bigint;
        cta_count: bigint;
        live_cta_count: bigint;
        cta_views: bigint;
        cta_clicks: bigint;
        workflow_count: bigint;
        published_workflow_count: bigint;
        workflow_runs_total: bigint;
        workflow_runs_30d: bigint;
        workflow_runs_completed: bigint;
        workflow_runs_failed: bigint;
        campaign_count: bigint;
        launched_campaign_count: bigint;
        email_campaign_sent: bigint;
        email_recipients: bigint;
        active_coupon_count: bigint;
        coupon_redemptions: bigint;
        coupon_redemptions_30d: bigint;
        coupon_discount_cents: bigint;
        event_count: bigint;
        event_registrations: bigint;
        event_registrations_30d: bigint;
      }>
    >`
      select
        (select count(*)::bigint from sales_attribution_events) as attribution_total,
        (
          select count(*)::bigint from sales_attribution_events
          where occurred_at >= now() - interval '30 days'
        ) as attribution_30d,
        coalesce((
          select sum(coalesce(revenue_cents, 0))::bigint from sales_attribution_events
        ), 0)::bigint as attribution_revenue_cents,
        (select count(*)::bigint from marketing_forms) as form_count,
        (
          select count(*)::bigint from marketing_forms where status = 'LIVE'
        ) as live_form_count,
        (select count(*)::bigint from marketing_form_submissions) as submission_count,
        (
          select count(*)::bigint from marketing_form_submissions
          where created_at >= now() - interval '30 days'
        ) as submissions_30d,
        (select count(*)::bigint from marketing_contacts) as contact_count,
        (
          select count(*)::bigint from marketing_contacts
          where created_at >= now() - interval '30 days'
        ) as contacts_30d,
        (select count(*)::bigint from marketing_ctas) as cta_count,
        (
          select count(*)::bigint from marketing_ctas where status = 'LIVE'
        ) as live_cta_count,
        coalesce((select sum(view_count)::bigint from marketing_ctas), 0)::bigint as cta_views,
        coalesce((select sum(click_count)::bigint from marketing_ctas), 0)::bigint as cta_clicks,
        (select count(*)::bigint from marketing_workflows) as workflow_count,
        (
          select count(*)::bigint from marketing_workflows where status = 'PUBLISHED'
        ) as published_workflow_count,
        (select count(*)::bigint from marketing_workflow_runs) as workflow_runs_total,
        (
          select count(*)::bigint from marketing_workflow_runs
          where created_at >= now() - interval '30 days'
        ) as workflow_runs_30d,
        (
          select count(*)::bigint from marketing_workflow_runs where status = 'COMPLETED'
        ) as workflow_runs_completed,
        (
          select count(*)::bigint from marketing_workflow_runs where status = 'FAILED'
        ) as workflow_runs_failed,
        (select count(*)::bigint from marketing_campaigns) as campaign_count,
        (
          select count(*)::bigint
          from marketing_campaigns
          where status in ('LAUNCHED', 'LIVE', 'ACTIVE', 'SENT')
             or launched_at is not null
        ) as launched_campaign_count,
        (
          select count(*)::bigint from marketing_email_campaigns where status = 'SENT'
        ) as email_campaign_sent,
        coalesce((
          select sum(recipient_count)::bigint from marketing_email_campaigns where status = 'SENT'
        ), 0)::bigint as email_recipients,
        (
          select count(*)::bigint from sales_coupons where status = 'ACTIVE'
        ) as active_coupon_count,
        (select count(*)::bigint from sales_coupon_redemptions) as coupon_redemptions,
        (
          select count(*)::bigint from sales_coupon_redemptions
          where created_at >= now() - interval '30 days'
        ) as coupon_redemptions_30d,
        coalesce((
          select sum(discount_cents)::bigint from sales_coupon_redemptions
        ), 0)::bigint as coupon_discount_cents,
        (select count(*)::bigint from marketing_events) as event_count,
        (
          select count(*)::bigint from marketing_event_registrations
        ) as event_registrations,
        (
          select count(*)::bigint from marketing_event_registrations
          where created_at >= now() - interval '30 days'
        ) as event_registrations_30d
    `,
    tx.$queryRaw<Array<{ source: string; count: bigint; revenue_cents: bigint }>>`
      select
        coalesce(nullif(utm_source, ''), 'direct') as source,
        count(*)::bigint as count,
        coalesce(sum(coalesce(revenue_cents, 0)), 0)::bigint as revenue_cents
      from sales_attribution_events
      group by coalesce(nullif(utm_source, ''), 'direct')
      order by count desc, revenue_cents desc
      limit 10
    `,
    tx.$queryRaw<Array<{ medium: string; count: bigint }>>`
      select
        coalesce(nullif(utm_medium, ''), 'none') as medium,
        count(*)::bigint as count
      from sales_attribution_events
      group by coalesce(nullif(utm_medium, ''), 'none')
      order by count desc
      limit 8
    `,
    tx.$queryRaw<Array<{ campaign: string; count: bigint; revenue_cents: bigint }>>`
      select
        coalesce(nullif(utm_campaign, ''), '(not set)') as campaign,
        count(*)::bigint as count,
        coalesce(sum(coalesce(revenue_cents, 0)), 0)::bigint as revenue_cents
      from sales_attribution_events
      group by coalesce(nullif(utm_campaign, ''), '(not set)')
      order by count desc, revenue_cents desc
      limit 8
    `,
    tx.$queryRaw<Array<{ period: string; submissions: number; contacts: number }>>`
      with days as (
        select generate_series(
          current_date - 29,
          current_date,
          interval '1 day'
        )::date as day
      )
      select
        to_char(d.day, 'YYYY-MM-DD') as period,
        coalesce((
          select count(*)::int from marketing_form_submissions s
          where s.created_at::date = d.day
        ), 0) as submissions,
        coalesce((
          select count(*)::int from marketing_contacts c
          where c.created_at::date = d.day
        ), 0) as contacts
      from days d
      order by d.day asc
    `,
    tx.$queryRaw<Array<{ id: string; title: string; status: string; submissions: bigint }>>`
      select
        f.id::text as id,
        f.title,
        f.status,
        count(s.id)::bigint as submissions
      from marketing_forms f
      left join marketing_form_submissions s
        on s.form_id = f.id and s.tenant_id = f.tenant_id
      group by f.id, f.title, f.status
      order by submissions desc, f.title asc
      limit 8
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        cta_type: string;
        status: string;
        views: number;
        clicks: number;
      }>
    >`
      select
        id::text as id,
        title,
        cta_type,
        status,
        view_count as views,
        click_count as clicks
      from marketing_ctas
      order by click_count desc, view_count desc, title asc
      limit 8
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        code: string;
        name: string;
        redemptions: bigint;
        discount_cents: bigint;
      }>
    >`
      select
        c.id::text as id,
        c.code,
        c.name,
        count(r.id)::bigint as redemptions,
        coalesce(sum(r.discount_cents), 0)::bigint as discount_cents
      from sales_coupons c
      left join sales_coupon_redemptions r
        on r.coupon_id = c.id and r.tenant_id = c.tenant_id
      group by c.id, c.code, c.name
      order by redemptions desc, discount_cents desc, c.code asc
      limit 8
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        workflow_title: string;
        status: string;
        trigger_event_type: string;
        created_at: Date;
      }>
    >`
      select
        r.id::text as id,
        coalesce(w.title, 'Workflow') as workflow_title,
        r.status,
        r.trigger_event_type,
        r.created_at
      from marketing_workflow_runs r
      left join marketing_workflows w
        on w.id = r.workflow_id and w.tenant_id = r.tenant_id
      order by r.created_at desc
      limit 8
    `,
  ]);

  const kpi = kpiRows[0];

  return {
    attributionTotal: asNumber(kpi?.attribution_total),
    attribution30d: asNumber(kpi?.attribution_30d),
    attributionRevenueCents: asNumber(kpi?.attribution_revenue_cents),
    formCount: asNumber(kpi?.form_count),
    liveFormCount: asNumber(kpi?.live_form_count),
    submissionCount: asNumber(kpi?.submission_count),
    submissions30d: asNumber(kpi?.submissions_30d),
    contactCount: asNumber(kpi?.contact_count),
    contacts30d: asNumber(kpi?.contacts_30d),
    ctaCount: asNumber(kpi?.cta_count),
    liveCtaCount: asNumber(kpi?.live_cta_count),
    ctaViews: asNumber(kpi?.cta_views),
    ctaClicks: asNumber(kpi?.cta_clicks),
    workflowCount: asNumber(kpi?.workflow_count),
    publishedWorkflowCount: asNumber(kpi?.published_workflow_count),
    workflowRunsTotal: asNumber(kpi?.workflow_runs_total),
    workflowRuns30d: asNumber(kpi?.workflow_runs_30d),
    workflowRunsCompleted: asNumber(kpi?.workflow_runs_completed),
    workflowRunsFailed: asNumber(kpi?.workflow_runs_failed),
    campaignCount: asNumber(kpi?.campaign_count),
    launchedCampaignCount: asNumber(kpi?.launched_campaign_count),
    emailCampaignSent: asNumber(kpi?.email_campaign_sent),
    emailRecipients: asNumber(kpi?.email_recipients),
    activeCouponCount: asNumber(kpi?.active_coupon_count),
    couponRedemptions: asNumber(kpi?.coupon_redemptions),
    couponRedemptions30d: asNumber(kpi?.coupon_redemptions_30d),
    couponDiscountCents: asNumber(kpi?.coupon_discount_cents),
    eventCount: asNumber(kpi?.event_count),
    eventRegistrations: asNumber(kpi?.event_registrations),
    eventRegistrations30d: asNumber(kpi?.event_registrations_30d),
    bySource: sourceRows.map((row) => ({
      source: row.source,
      count: asNumber(row.count),
      revenueCents: asNumber(row.revenue_cents),
    })),
    byMedium: mediumRows.map((row) => ({
      medium: row.medium,
      count: asNumber(row.count),
    })),
    byCampaign: campaignRows.map((row) => ({
      campaign: row.campaign,
      count: asNumber(row.count),
      revenueCents: asNumber(row.revenue_cents),
    })),
    dailyLeads: dailyLeadRows.map((row) => ({
      period: row.period,
      submissions: row.submissions,
      contacts: row.contacts,
    })),
    topForms: topFormRows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      submissions: asNumber(row.submissions),
    })),
    topCtas: topCtaRows.map((row) => ({
      id: row.id,
      title: row.title,
      ctaType: row.cta_type,
      status: row.status,
      views: row.views,
      clicks: row.clicks,
    })),
    topCoupons: topCouponRows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      redemptions: asNumber(row.redemptions),
      discountCents: asNumber(row.discount_cents),
    })),
    recentWorkflowRuns: recentRunRows.map((row) => ({
      id: row.id,
      workflowTitle: row.workflow_title,
      status: row.status,
      triggerEventType: row.trigger_event_type,
      createdAt: row.created_at.toISOString(),
    })),
  };
}

export type MarketingAttributionDetail = {
  events: number;
  events30d: number;
  attributedRevenueCents: number;
  sourceCount: number;
  mediumCount: number;
  campaignCount: number;
  sources: Array<{ value: string; count: number; revenueCents: number }>;
  mediums: Array<{ value: string; count: number; revenueCents: number }>;
  campaigns: Array<{ value: string; count: number; revenueCents: number }>;
  crossPairs: Array<{ source: string; medium: string; count: number }>;
};

export async function loadMarketingAttributionDetail(
  tx: TenantTx,
): Promise<MarketingAttributionDetail> {
  const [kpiRows, sourceRows, mediumRows, campaignRows, crossRows] = await Promise.all([
    tx.$queryRaw<
      Array<{
        attribution_total: bigint;
        attribution_30d: bigint;
        attribution_revenue_cents: bigint;
        source_count: bigint;
        medium_count: bigint;
        campaign_count: bigint;
      }>
    >`
      select
        (select count(*)::bigint from sales_attribution_events) as attribution_total,
        (
          select count(*)::bigint from sales_attribution_events
          where created_at >= now() - interval '30 days'
        ) as attribution_30d,
        coalesce((
          select sum(coalesce(revenue_cents, 0))::bigint from sales_attribution_events
        ), 0)::bigint as attribution_revenue_cents,
        (
          select count(distinct coalesce(nullif(utm_source, ''), 'direct'))::bigint
          from sales_attribution_events
        ) as source_count,
        (
          select count(distinct coalesce(nullif(utm_medium, ''), 'none'))::bigint
          from sales_attribution_events
        ) as medium_count,
        (
          select count(distinct coalesce(nullif(utm_campaign, ''), '(not set)'))::bigint
          from sales_attribution_events
        ) as campaign_count
    `,
    tx.$queryRaw<Array<{ value: string; count: bigint; revenue_cents: bigint }>>`
      select
        coalesce(nullif(utm_source, ''), 'direct') as value,
        count(*)::bigint as count,
        coalesce(sum(coalesce(revenue_cents, 0)), 0)::bigint as revenue_cents
      from sales_attribution_events
      group by 1
      order by count desc, revenue_cents desc
      limit 50
    `,
    tx.$queryRaw<Array<{ value: string; count: bigint; revenue_cents: bigint }>>`
      select
        coalesce(nullif(utm_medium, ''), 'none') as value,
        count(*)::bigint as count,
        coalesce(sum(coalesce(revenue_cents, 0)), 0)::bigint as revenue_cents
      from sales_attribution_events
      group by 1
      order by count desc, revenue_cents desc
      limit 50
    `,
    tx.$queryRaw<Array<{ value: string; count: bigint; revenue_cents: bigint }>>`
      select
        coalesce(nullif(utm_campaign, ''), '(not set)') as value,
        count(*)::bigint as count,
        coalesce(sum(coalesce(revenue_cents, 0)), 0)::bigint as revenue_cents
      from sales_attribution_events
      group by 1
      order by count desc, revenue_cents desc
      limit 50
    `,
    tx.$queryRaw<Array<{ source: string; medium: string; count: bigint }>>`
      select
        coalesce(nullif(utm_source, ''), 'direct') as source,
        coalesce(nullif(utm_medium, ''), 'none') as medium,
        count(*)::bigint as count
      from sales_attribution_events
      group by 1, 2
      order by count desc
      limit 36
    `,
  ]);

  const kpi = kpiRows[0];
  return {
    events: asNumber(kpi?.attribution_total),
    events30d: asNumber(kpi?.attribution_30d),
    attributedRevenueCents: asNumber(kpi?.attribution_revenue_cents),
    sourceCount: asNumber(kpi?.source_count),
    mediumCount: asNumber(kpi?.medium_count),
    campaignCount: asNumber(kpi?.campaign_count),
    sources: sourceRows.map((row) => ({
      value: row.value,
      count: asNumber(row.count),
      revenueCents: asNumber(row.revenue_cents),
    })),
    mediums: mediumRows.map((row) => ({
      value: row.value,
      count: asNumber(row.count),
      revenueCents: asNumber(row.revenue_cents),
    })),
    campaigns: campaignRows.map((row) => ({
      value: row.value,
      count: asNumber(row.count),
      revenueCents: asNumber(row.revenue_cents),
    })),
    crossPairs: crossRows.map((row) => ({
      source: row.source,
      medium: row.medium,
      count: asNumber(row.count),
    })),
  };
}

export type MarketingCaptureDetail = {
  formCount: number;
  liveFormCount: number;
  submissionCount: number;
  submissions30d: number;
  contactCount: number;
  ctaCount: number;
  liveCtaCount: number;
  ctaViews: number;
  ctaClicks: number;
  forms: Array<{
    id: string;
    title: string;
    status: string;
    submissions: number;
    submissions30d: number;
    lastSubmissionAt: string | null;
    href: string;
  }>;
  ctas: Array<{
    id: string;
    title: string;
    ctaType: string;
    status: string;
    views: number;
    clicks: number;
    href: string;
  }>;
};

export async function loadMarketingCaptureDetail(tx: TenantTx): Promise<MarketingCaptureDetail> {
  const [kpiRows, formRows, ctaRows] = await Promise.all([
    tx.$queryRaw<
      Array<{
        form_count: bigint;
        live_form_count: bigint;
        submission_count: bigint;
        submissions_30d: bigint;
        contact_count: bigint;
        cta_count: bigint;
        live_cta_count: bigint;
        cta_views: bigint;
        cta_clicks: bigint;
      }>
    >`
      select
        (select count(*)::bigint from marketing_forms) as form_count,
        (
          select count(*)::bigint from marketing_forms where status = 'LIVE'
        ) as live_form_count,
        (select count(*)::bigint from marketing_form_submissions) as submission_count,
        (
          select count(*)::bigint from marketing_form_submissions
          where created_at >= now() - interval '30 days'
        ) as submissions_30d,
        (select count(*)::bigint from marketing_contacts) as contact_count,
        (select count(*)::bigint from marketing_ctas) as cta_count,
        (
          select count(*)::bigint from marketing_ctas where status = 'LIVE'
        ) as live_cta_count,
        coalesce((select sum(view_count)::bigint from marketing_ctas), 0)::bigint as cta_views,
        coalesce((select sum(click_count)::bigint from marketing_ctas), 0)::bigint as cta_clicks
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        status: string;
        submissions: bigint;
        submissions_30d: bigint;
        last_submission_at: Date | null;
      }>
    >`
      select
        f.id::text as id,
        f.title,
        f.status,
        count(s.id)::bigint as submissions,
        count(s.id) filter (
          where s.created_at >= now() - interval '30 days'
        )::bigint as submissions_30d,
        max(s.created_at) as last_submission_at
      from marketing_forms f
      left join marketing_form_submissions s
        on s.form_id = f.id and s.tenant_id = f.tenant_id
      group by f.id, f.title, f.status
      order by submissions desc, f.title asc
      limit 24
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        cta_type: string;
        status: string;
        views: number;
        clicks: number;
      }>
    >`
      select
        id::text as id,
        title,
        cta_type,
        status,
        view_count as views,
        click_count as clicks
      from marketing_ctas
      order by click_count desc, view_count desc, title asc
      limit 24
    `,
  ]);

  const kpi = kpiRows[0];

  return {
    formCount: asNumber(kpi?.form_count),
    liveFormCount: asNumber(kpi?.live_form_count),
    submissionCount: asNumber(kpi?.submission_count),
    submissions30d: asNumber(kpi?.submissions_30d),
    contactCount: asNumber(kpi?.contact_count),
    ctaCount: asNumber(kpi?.cta_count),
    liveCtaCount: asNumber(kpi?.live_cta_count),
    ctaViews: asNumber(kpi?.cta_views),
    ctaClicks: asNumber(kpi?.cta_clicks),
    forms: formRows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      submissions: asNumber(row.submissions),
      submissions30d: asNumber(row.submissions_30d),
      lastSubmissionAt: row.last_submission_at?.toISOString() ?? null,
      href: `/admin/marketing/forms/${row.id}`,
    })),
    ctas: ctaRows.map((row) => ({
      id: row.id,
      title: row.title,
      ctaType: row.cta_type,
      status: row.status,
      views: row.views,
      clicks: row.clicks,
      href: `/admin/marketing/cta/${row.id}`,
    })),
  };
}

export type MarketingWorkflowsDetail = {
  workflowCount: number;
  publishedWorkflowCount: number;
  runs30d: number;
  runsCompleted30d: number;
  runsFailed30d: number;
  lastRunAt: string | null;
  dailyVolume: Array<{ period: string; completed: number; failed: number; total: number }>;
  byWorkflow: Array<{
    id: string;
    title: string;
    status: string;
    runs30d: number;
    completed30d: number;
    failed30d: number;
    lastRunAt: string | null;
    publishedAt: string | null;
    href: string;
  }>;
  neverRun: Array<{ id: string; title: string; publishedAt: string | null; href: string }>;
  triggers: Array<{ trigger: string; runs: number }>;
  ledger: Array<{
    id: string;
    workflowId: string;
    workflowTitle: string;
    status: string;
    triggerEventType: string;
    createdAt: string;
    errorMessage: string | null;
    href: string;
    workflowHref: string;
  }>;
};

export async function loadMarketingWorkflowsDetail(
  tx: TenantTx,
): Promise<MarketingWorkflowsDetail> {
  const [kpiRows, dailyRows, byWorkflowRows, neverRunRows, triggerRows, ledgerRows] =
    await Promise.all([
      tx.$queryRaw<
        Array<{
          workflow_count: bigint;
          published_workflow_count: bigint;
          runs_30d: bigint;
          runs_completed_30d: bigint;
          runs_failed_30d: bigint;
          last_run_at: Date | null;
        }>
      >`
      select
        (select count(*)::bigint from marketing_workflows) as workflow_count,
        (
          select count(*)::bigint from marketing_workflows where status = 'PUBLISHED'
        ) as published_workflow_count,
        (
          select count(*)::bigint from marketing_workflow_runs
          where created_at >= now() - interval '30 days'
        ) as runs_30d,
        (
          select count(*)::bigint from marketing_workflow_runs
          where created_at >= now() - interval '30 days'
            and status = 'COMPLETED'
        ) as runs_completed_30d,
        (
          select count(*)::bigint from marketing_workflow_runs
          where created_at >= now() - interval '30 days'
            and status = 'FAILED'
        ) as runs_failed_30d,
        (
          select max(created_at) from marketing_workflow_runs
        ) as last_run_at
    `,
      tx.$queryRaw<Array<{ period: string; completed: number; failed: number; total: number }>>`
      with days as (
        select generate_series(
          current_date - 29,
          current_date,
          interval '1 day'
        )::date as day
      )
      select
        to_char(d.day, 'YYYY-MM-DD') as period,
        coalesce((
          select count(*)::int from marketing_workflow_runs r
          where r.created_at::date = d.day and r.status = 'COMPLETED'
        ), 0) as completed,
        coalesce((
          select count(*)::int from marketing_workflow_runs r
          where r.created_at::date = d.day and r.status = 'FAILED'
        ), 0) as failed,
        coalesce((
          select count(*)::int from marketing_workflow_runs r
          where r.created_at::date = d.day
        ), 0) as total
      from days d
      order by d.day asc
    `,
      tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          status: string;
          runs_30d: bigint;
          completed_30d: bigint;
          failed_30d: bigint;
          last_run_at: Date | null;
          published_at: Date | null;
        }>
      >`
      select
        w.id::text as id,
        w.title,
        w.status,
        count(r.id) filter (
          where r.created_at >= now() - interval '30 days'
        )::bigint as runs_30d,
        count(r.id) filter (
          where r.created_at >= now() - interval '30 days'
            and r.status = 'COMPLETED'
        )::bigint as completed_30d,
        count(r.id) filter (
          where r.created_at >= now() - interval '30 days'
            and r.status = 'FAILED'
        )::bigint as failed_30d,
        max(r.created_at) as last_run_at,
        w.published_at
      from marketing_workflows w
      left join marketing_workflow_runs r
        on r.workflow_id = w.id and r.tenant_id = w.tenant_id
      group by w.id, w.title, w.status, w.published_at
      order by runs_30d desc, failed_30d desc, w.title asc
      limit 24
    `,
      tx.$queryRaw<Array<{ id: string; title: string; published_at: Date | null }>>`
      select
        w.id::text as id,
        w.title,
        w.published_at
      from marketing_workflows w
      where w.status = 'PUBLISHED'
        and not exists (
          select 1 from marketing_workflow_runs r
          where r.workflow_id = w.id
            and r.tenant_id = w.tenant_id
            and r.created_at >= now() - interval '30 days'
        )
      order by w.published_at desc nulls last, w.title asc
      limit 12
    `,
      tx.$queryRaw<Array<{ trigger: string; runs: bigint }>>`
      select
        r.trigger_event_type as trigger,
        count(*)::bigint as runs
      from marketing_workflow_runs r
      where r.created_at >= now() - interval '30 days'
      group by r.trigger_event_type
      order by runs desc, trigger asc
      limit 16
    `,
      tx.$queryRaw<
        Array<{
          id: string;
          workflow_id: string;
          workflow_title: string;
          status: string;
          trigger_event_type: string;
          created_at: Date;
          error_message: string | null;
        }>
      >`
      select
        r.id::text as id,
        r.workflow_id::text as workflow_id,
        coalesce(w.title, 'Workflow') as workflow_title,
        r.status,
        r.trigger_event_type,
        r.created_at,
        r.error_message
      from marketing_workflow_runs r
      left join marketing_workflows w
        on w.id = r.workflow_id and w.tenant_id = r.tenant_id
      order by r.created_at desc
      limit 48
    `,
    ]);

  const kpi = kpiRows[0];

  return {
    workflowCount: asNumber(kpi?.workflow_count),
    publishedWorkflowCount: asNumber(kpi?.published_workflow_count),
    runs30d: asNumber(kpi?.runs_30d),
    runsCompleted30d: asNumber(kpi?.runs_completed_30d),
    runsFailed30d: asNumber(kpi?.runs_failed_30d),
    lastRunAt: kpi?.last_run_at?.toISOString() ?? null,
    dailyVolume: dailyRows.map((row) => ({
      period: row.period,
      completed: row.completed,
      failed: row.failed,
      total: row.total,
    })),
    byWorkflow: byWorkflowRows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      runs30d: asNumber(row.runs_30d),
      completed30d: asNumber(row.completed_30d),
      failed30d: asNumber(row.failed_30d),
      lastRunAt: row.last_run_at?.toISOString() ?? null,
      publishedAt: row.published_at?.toISOString() ?? null,
      href: `/admin/marketing/workflows/${row.id}`,
    })),
    neverRun: neverRunRows.map((row) => ({
      id: row.id,
      title: row.title,
      publishedAt: row.published_at?.toISOString() ?? null,
      href: `/admin/marketing/workflows/${row.id}`,
    })),
    triggers: triggerRows.map((row) => ({
      trigger: row.trigger,
      runs: asNumber(row.runs),
    })),
    ledger: ledgerRows.map((row) => ({
      id: row.id,
      workflowId: row.workflow_id,
      workflowTitle: row.workflow_title,
      status: row.status,
      triggerEventType: row.trigger_event_type,
      createdAt: row.created_at.toISOString(),
      errorMessage: row.error_message,
      href: `/admin/marketing/workflows/${row.workflow_id}?runId=${row.id}`,
      workflowHref: `/admin/marketing/workflows/${row.workflow_id}`,
    })),
  };
}

export type MessengerInsightSnapshot = {
  emailSentCount: number;
  emailScheduledCount: number;
  emailDraftCount: number;
  emailRecipients: number;
  emailRecipients30d: number;
  pushSentCount: number;
  pushScheduledCount: number;
  pushRecipients: number;
  pushRecipients30d: number;
  whatsappSentCount: number;
  whatsappScheduledCount: number;
  whatsappRecipients: number;
  whatsappDelivered: number;
  whatsappFailed: number;
  whatsappConnected: boolean;
  announcementCount: number;
  announcementRecipients: number;
  inboxMessageCount: number;
  inboxMessages30d: number;
  openConversationCount: number;
  totalOutboundSends: number;
  totalOutboundReach: number;
  channelMix: Array<{ channel: string; sends: number; recipients: number }>;
  dailyVolume: Array<{
    period: string;
    emailRecipients: number;
    pushRecipients: number;
    whatsappRecipients: number;
    whatsappDelivered: number;
    whatsappFailed: number;
    inboxMessages: number;
  }>;
  recentEmailCampaigns: Array<{
    id: string;
    title: string;
    status: string;
    recipientCount: number;
    sentAt: string | null;
  }>;
  recentPushMessages: Array<{
    id: string;
    title: string;
    status: string;
    recipientCount: number;
    channels: string;
    sentAt: string | null;
  }>;
  recentWhatsappCampaigns: Array<{
    id: string;
    title: string;
    status: string;
    recipientCount: number;
    deliveredCount: number;
    failedCount: number;
    sentAt: string | null;
  }>;
  recentAnnouncements: Array<{
    id: string;
    title: string;
    type: string;
    recipientCount: number;
    sentAt: string | null;
  }>;
};

/** Messaging-channel snapshot for Insights → Messenger Insight (Learnyst-style). */
export async function loadMessengerInsightSnapshot(
  tx: TenantTx,
): Promise<MessengerInsightSnapshot> {
  const [kpiRows, dailyRows, emailRows, pushRows, whatsappRows, announcementRows] =
    await Promise.all([
      tx.$queryRaw<
        Array<{
          email_sent: bigint;
          email_scheduled: bigint;
          email_draft: bigint;
          email_recipients: bigint;
          email_recipients_30d: bigint;
          push_sent: bigint;
          push_scheduled: bigint;
          push_recipients: bigint;
          push_recipients_30d: bigint;
          wa_sent: bigint;
          wa_scheduled: bigint;
          wa_recipients: bigint;
          wa_delivered: bigint;
          wa_failed: bigint;
          wa_connected: boolean;
          announcement_count: bigint;
          announcement_recipients: bigint;
          inbox_messages: bigint;
          inbox_messages_30d: bigint;
          open_conversations: bigint;
        }>
      >`
      select
        (
          select count(*)::bigint from marketing_email_campaigns where status = 'SENT'
        ) as email_sent,
        (
          select count(*)::bigint from marketing_email_campaigns where status = 'SCHEDULED'
        ) as email_scheduled,
        (
          select count(*)::bigint from marketing_email_campaigns where status = 'DRAFT'
        ) as email_draft,
        coalesce((
          select sum(recipient_count)::bigint from marketing_email_campaigns where status = 'SENT'
        ), 0)::bigint as email_recipients,
        coalesce((
          select sum(recipient_count)::bigint
          from marketing_email_campaigns
          where status = 'SENT'
            and coalesce(sent_at, created_at) >= now() - interval '30 days'
        ), 0)::bigint as email_recipients_30d,
        (
          select count(*)::bigint from push_messages where status = 'SENT'
        ) as push_sent,
        (
          select count(*)::bigint from push_messages where status = 'SCHEDULED'
        ) as push_scheduled,
        coalesce((
          select sum(recipient_count)::bigint from push_messages where status = 'SENT'
        ), 0)::bigint as push_recipients,
        coalesce((
          select sum(recipient_count)::bigint
          from push_messages
          where status = 'SENT'
            and coalesce(sent_at, created_at) >= now() - interval '30 days'
        ), 0)::bigint as push_recipients_30d,
        (
          select count(*)::bigint from whatsapp_campaigns where status = 'SENT'
        ) as wa_sent,
        (
          select count(*)::bigint from whatsapp_campaigns where status = 'SCHEDULED'
        ) as wa_scheduled,
        coalesce((
          select sum(recipient_count)::bigint from whatsapp_campaigns where status = 'SENT'
        ), 0)::bigint as wa_recipients,
        coalesce((
          select sum(delivered_count)::bigint from whatsapp_campaigns where status = 'SENT'
        ), 0)::bigint as wa_delivered,
        coalesce((
          select sum(failed_count)::bigint from whatsapp_campaigns where status = 'SENT'
        ), 0)::bigint as wa_failed,
        exists(
          select 1 from whatsapp_connections where status = 'CONNECTED'
        ) as wa_connected,
        (select count(*)::bigint from announcements) as announcement_count,
        coalesce((
          select sum(recipient_count)::bigint from announcements
        ), 0)::bigint as announcement_recipients,
        (select count(*)::bigint from messenger_messages) as inbox_messages,
        (
          select count(*)::bigint from messenger_messages
          where sent_at >= now() - interval '30 days'
        ) as inbox_messages_30d,
        (
          select count(*)::bigint from messenger_conversations where status = 'open'
        ) as open_conversations
    `,
      tx.$queryRaw<
        Array<{
          period: string;
          email_recipients: number;
          push_recipients: number;
          whatsapp_recipients: number;
          whatsapp_delivered: number;
          whatsapp_failed: number;
          inbox_messages: number;
        }>
      >`
      with days as (
        select generate_series(
          current_date - 29,
          current_date,
          interval '1 day'
        )::date as day
      )
      select
        to_char(d.day, 'YYYY-MM-DD') as period,
        coalesce((
          select sum(mec.recipient_count)::int
          from marketing_email_campaigns mec
          where mec.status = 'SENT'
            and coalesce(mec.sent_at, mec.created_at)::date = d.day
        ), 0) as email_recipients,
        coalesce((
          select sum(pm.recipient_count)::int
          from push_messages pm
          where pm.status = 'SENT'
            and coalesce(pm.sent_at, pm.created_at)::date = d.day
        ), 0) as push_recipients,
        coalesce((
          select sum(wc.recipient_count)::int
          from whatsapp_campaigns wc
          where wc.status = 'SENT'
            and coalesce(wc.sent_at, wc.created_at)::date = d.day
        ), 0) as whatsapp_recipients,
        coalesce((
          select sum(wc.delivered_count)::int
          from whatsapp_campaigns wc
          where wc.status = 'SENT'
            and coalesce(wc.sent_at, wc.created_at)::date = d.day
        ), 0) as whatsapp_delivered,
        coalesce((
          select sum(wc.failed_count)::int
          from whatsapp_campaigns wc
          where wc.status = 'SENT'
            and coalesce(wc.sent_at, wc.created_at)::date = d.day
        ), 0) as whatsapp_failed,
        coalesce((
          select count(*)::int from messenger_messages mm
          where mm.sent_at::date = d.day
        ), 0) as inbox_messages
      from days d
      order by d.day asc
    `,
      tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          status: string;
          recipient_count: number;
          sent_at: Date | null;
        }>
      >`
      select
        id::text as id,
        title,
        status,
        recipient_count,
        sent_at
      from marketing_email_campaigns
      order by coalesce(sent_at, created_at) desc
      limit 8
    `,
      tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          status: string;
          recipient_count: number;
          channel_android: boolean;
          channel_ios: boolean;
          channel_web: boolean;
          sent_at: Date | null;
        }>
      >`
      select
        id::text as id,
        title,
        status,
        recipient_count,
        channel_android,
        channel_ios,
        channel_web,
        sent_at
      from push_messages
      order by coalesce(sent_at, created_at) desc
      limit 8
    `,
      tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          status: string;
          recipient_count: number;
          delivered_count: number;
          failed_count: number;
          sent_at: Date | null;
        }>
      >`
      select
        id::text as id,
        title,
        status,
        recipient_count,
        delivered_count,
        failed_count,
        sent_at
      from whatsapp_campaigns
      order by coalesce(sent_at, created_at) desc
      limit 12
    `,
      tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          type: string;
          recipient_count: number;
          sent_at: Date | null;
        }>
      >`
      select
        id::text as id,
        title,
        type,
        recipient_count,
        sent_at
      from announcements
      order by coalesce(sent_at, created_at) desc
      limit 8
    `,
    ]);

  const kpi = kpiRows[0];
  const emailSent = asNumber(kpi?.email_sent);
  const pushSent = asNumber(kpi?.push_sent);
  const waSent = asNumber(kpi?.wa_sent);
  const announcementCount = asNumber(kpi?.announcement_count);
  const emailRecipients = asNumber(kpi?.email_recipients);
  const pushRecipients = asNumber(kpi?.push_recipients);
  const waRecipients = asNumber(kpi?.wa_recipients);
  const announcementRecipients = asNumber(kpi?.announcement_recipients);

  function pushChannels(row: {
    channel_android: boolean;
    channel_ios: boolean;
    channel_web: boolean;
  }): string {
    const parts: string[] = [];
    if (row.channel_android) parts.push("Android");
    if (row.channel_ios) parts.push("iOS");
    if (row.channel_web) parts.push("Web");
    return parts.length > 0 ? parts.join(", ") : "None";
  }

  return {
    emailSentCount: emailSent,
    emailScheduledCount: asNumber(kpi?.email_scheduled),
    emailDraftCount: asNumber(kpi?.email_draft),
    emailRecipients,
    emailRecipients30d: asNumber(kpi?.email_recipients_30d),
    pushSentCount: pushSent,
    pushScheduledCount: asNumber(kpi?.push_scheduled),
    pushRecipients,
    pushRecipients30d: asNumber(kpi?.push_recipients_30d),
    whatsappSentCount: waSent,
    whatsappScheduledCount: asNumber(kpi?.wa_scheduled),
    whatsappRecipients: waRecipients,
    whatsappDelivered: asNumber(kpi?.wa_delivered),
    whatsappFailed: asNumber(kpi?.wa_failed),
    whatsappConnected: Boolean(kpi?.wa_connected),
    announcementCount,
    announcementRecipients,
    inboxMessageCount: asNumber(kpi?.inbox_messages),
    inboxMessages30d: asNumber(kpi?.inbox_messages_30d),
    openConversationCount: asNumber(kpi?.open_conversations),
    totalOutboundSends: emailSent + pushSent + waSent + announcementCount,
    totalOutboundReach: emailRecipients + pushRecipients + waRecipients + announcementRecipients,
    channelMix: [
      { channel: "Email", sends: emailSent, recipients: emailRecipients },
      { channel: "Push", sends: pushSent, recipients: pushRecipients },
      { channel: "WhatsApp", sends: waSent, recipients: waRecipients },
      {
        channel: "Announcements",
        sends: announcementCount,
        recipients: announcementRecipients,
      },
      {
        channel: "Inbox messages",
        sends: asNumber(kpi?.inbox_messages),
        recipients: asNumber(kpi?.inbox_messages),
      },
    ],
    dailyVolume: dailyRows.map((row) => ({
      period: row.period,
      emailRecipients: row.email_recipients,
      pushRecipients: row.push_recipients,
      whatsappRecipients: row.whatsapp_recipients,
      whatsappDelivered: row.whatsapp_delivered,
      whatsappFailed: row.whatsapp_failed,
      inboxMessages: row.inbox_messages,
    })),
    recentEmailCampaigns: emailRows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      recipientCount: row.recipient_count,
      sentAt: row.sent_at?.toISOString() ?? null,
    })),
    recentPushMessages: pushRows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      recipientCount: row.recipient_count,
      channels: pushChannels(row),
      sentAt: row.sent_at?.toISOString() ?? null,
    })),
    recentWhatsappCampaigns: whatsappRows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      recipientCount: row.recipient_count,
      deliveredCount: row.delivered_count,
      failedCount: row.failed_count,
      sentAt: row.sent_at?.toISOString() ?? null,
    })),
    recentAnnouncements: announcementRows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      recipientCount: row.recipient_count,
      sentAt: row.sent_at?.toISOString() ?? null,
    })),
  };
}

export type MessengerInboxResponseTimeBucketId = "0-1h" | "1-4h" | "4-24h" | "24h+";

export type MessengerInboxInsightDetail = {
  openConversations: Array<{
    id: string;
    learnerName: string;
    lastMessagePreview: string;
    messageCount: number;
    lastMessageAt: string;
    waitingOn: "us" | "learner";
  }>;
  responseTimes: {
    samples: number;
    medianFirstReplySeconds: number | null;
    longestFirstReplySeconds: number | null;
    longestWaitingSeconds: number | null;
    buckets: Array<{
      id: MessengerInboxResponseTimeBucketId;
      label: string;
      count: number;
      sharePct: number | null;
    }>;
  };
};

function truncatePreview(body: string, max = 120): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function medianSeconds(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const left = sorted[mid - 1];
    const right = sorted[mid];
    if (left === undefined || right === undefined) return null;
    return Math.round((left + right) / 2);
  }
  const value = sorted[mid];
  return value === undefined ? null : Math.round(value);
}

function bucketFirstReply(seconds: number): MessengerInboxResponseTimeBucketId {
  if (seconds < 3600) return "0-1h";
  if (seconds < 14400) return "1-4h";
  if (seconds < 86400) return "4-24h";
  return "24h+";
}

const INBOX_REPLY_BUCKETS: Array<{
  id: MessengerInboxResponseTimeBucketId;
  label: string;
}> = [
  { id: "0-1h", label: "0-1h" },
  { id: "1-4h", label: "1-4h" },
  { id: "4-24h", label: "4-24h" },
  { id: "24h+", label: "24h+" },
];

/** Open conversations + first-reply timings for Messenger Insight → Inbox. */
export async function loadMessengerInboxDetail(tx: TenantTx): Promise<MessengerInboxInsightDetail> {
  const [openRows, replyRows] = await Promise.all([
    tx.$queryRaw<
      Array<{
        id: string;
        learner_name: string | null;
        last_message_preview: string | null;
        message_count: number;
        last_message_at: Date | null;
        waiting_on: "us" | "learner";
      }>
    >`
      with open_convs as (
        select mc.id
        from messenger_conversations mc
        where mc.status = 'open'
      ),
      last_msg as (
        select distinct on (mm.conversation_id)
          mm.conversation_id,
          mm.body,
          mm.sent_at,
          mm.sender_membership_id
        from messenger_messages mm
        join open_convs oc on oc.id = mm.conversation_id
        order by mm.conversation_id, mm.sent_at desc, mm.id desc
      ),
      msg_counts as (
        select mm.conversation_id, count(*)::int as message_count
        from messenger_messages mm
        join open_convs oc on oc.id = mm.conversation_id
        group by mm.conversation_id
      ),
      first_learner as (
        select distinct on (mm.conversation_id)
          mm.conversation_id,
          mm.sender_membership_id
        from messenger_messages mm
        join open_convs oc on oc.id = mm.conversation_id
        join user_roles ur
          on ur.membership_id = mm.sender_membership_id and ur.tenant_id = mm.tenant_id
        join roles r
          on r.id = ur.role_id and r.tenant_id = ur.tenant_id and r.key = 'learner'
        order by mm.conversation_id, mm.sent_at asc, mm.id asc
      ),
      last_sender_is_learner as (
        select
          lm.conversation_id,
          exists(
            select 1
            from user_roles ur
            join roles r
              on r.id = ur.role_id and r.tenant_id = ur.tenant_id and r.key = 'learner'
            where ur.membership_id = lm.sender_membership_id
          ) as is_learner
        from last_msg lm
      )
      select
        oc.id::text as id,
        coalesce(
          fl_mp.display_name,
          fl_ap.email,
          fl_m.invited_email_normalized,
          lm_mp.display_name,
          lm_ap.email,
          lm_m.invited_email_normalized,
          'Learner'
        ) as learner_name,
        left(coalesce(lm.body, ''), 200) as last_message_preview,
        coalesce(mc.message_count, 0)::int as message_count,
        lm.sent_at as last_message_at,
        case
          when coalesce(lsl.is_learner, false) then 'us'
          else 'learner'
        end as waiting_on
      from open_convs oc
      left join last_msg lm on lm.conversation_id = oc.id
      left join msg_counts mc on mc.conversation_id = oc.id
      left join last_sender_is_learner lsl on lsl.conversation_id = oc.id
      left join first_learner fl on fl.conversation_id = oc.id
      left join memberships fl_m on fl_m.id = fl.sender_membership_id
      left join member_profiles fl_mp
        on fl_mp.membership_id = fl_m.id
        and fl_mp.tenant_id = fl_m.tenant_id
        and fl_mp.deleted_at is null
      left join auth_principals fl_ap on fl_ap.id = fl_m.auth_principal_id
      left join memberships lm_m on lm_m.id = lm.sender_membership_id
      left join member_profiles lm_mp
        on lm_mp.membership_id = lm_m.id
        and lm_mp.tenant_id = lm_m.tenant_id
        and lm_mp.deleted_at is null
      left join auth_principals lm_ap on lm_ap.id = lm_m.auth_principal_id
      order by lm.sent_at asc nulls last
      limit 10
    `,
    tx.$queryRaw<Array<{ reply_seconds: number }>>`
      with first_learner_msg as (
        select distinct on (mm.conversation_id)
          mm.conversation_id,
          mm.sent_at as first_learner_at
        from messenger_messages mm
        join user_roles ur
          on ur.membership_id = mm.sender_membership_id and ur.tenant_id = mm.tenant_id
        join roles r
          on r.id = ur.role_id and r.tenant_id = ur.tenant_id and r.key = 'learner'
        order by mm.conversation_id, mm.sent_at asc, mm.id asc
      ),
      first_staff_reply as (
        select
          fl.conversation_id,
          fl.first_learner_at,
          min(mm.sent_at) as first_reply_at
        from first_learner_msg fl
        join messenger_messages mm
          on mm.conversation_id = fl.conversation_id
          and mm.sent_at > fl.first_learner_at
        where not exists (
          select 1
          from user_roles ur
          join roles r
            on r.id = ur.role_id and r.tenant_id = ur.tenant_id and r.key = 'learner'
          where ur.membership_id = mm.sender_membership_id
        )
        group by fl.conversation_id, fl.first_learner_at
      )
      select
        greatest(
          0,
          floor(extract(epoch from (fsr.first_reply_at - fsr.first_learner_at)))
        )::int as reply_seconds
      from first_staff_reply fsr
    `,
  ]);

  const nowMs = Date.now();
  const openConversations = openRows.map((row) => ({
    id: row.id,
    learnerName: row.learner_name?.trim() || "Learner",
    lastMessagePreview: truncatePreview(row.last_message_preview ?? ""),
    messageCount: row.message_count,
    lastMessageAt: row.last_message_at?.toISOString() ?? new Date(0).toISOString(),
    waitingOn: row.waiting_on,
  }));

  const replySeconds = replyRows.map((row) => row.reply_seconds);
  const samples = replySeconds.length;
  const bucketCounts: Record<MessengerInboxResponseTimeBucketId, number> = {
    "0-1h": 0,
    "1-4h": 0,
    "4-24h": 0,
    "24h+": 0,
  };
  for (const value of replySeconds) {
    bucketCounts[bucketFirstReply(value)] += 1;
  }

  let longestWaitingSeconds: number | null = null;
  for (const row of openConversations) {
    if (row.waitingOn !== "us") continue;
    const age = Math.max(0, Math.floor((nowMs - Date.parse(row.lastMessageAt)) / 1000));
    if (!Number.isFinite(age)) continue;
    if (longestWaitingSeconds == null || age > longestWaitingSeconds) {
      longestWaitingSeconds = age;
    }
  }

  return {
    openConversations,
    responseTimes: {
      samples,
      medianFirstReplySeconds: medianSeconds(replySeconds),
      longestFirstReplySeconds: samples === 0 ? null : Math.max(...replySeconds),
      longestWaitingSeconds,
      buckets: INBOX_REPLY_BUCKETS.map((bucket) => {
        const count = bucketCounts[bucket.id];
        return {
          id: bucket.id,
          label: bucket.label,
          count,
          sharePct: samples <= 0 ? null : Math.round((count / samples) * 1000) / 10,
        };
      }),
    },
  };
}

export async function loadInsightAlertStateJson(tx: TenantTx): Promise<unknown> {
  const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
    select config_json
    from tenant_config
    limit 1
  `;
  const config = rows[0]?.config_json;
  if (!config || typeof config !== "object") return null;
  return (config as Record<string, unknown>)["insightAlerts"] ?? null;
}

export async function saveInsightAlertStateJson(tx: TenantTx, state: unknown): Promise<void> {
  await tx.$executeRaw`
    insert into tenant_config (
      id,
      tenant_id,
      config_json,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      app.current_tenant_id(),
      jsonb_build_object('insightAlerts', ${JSON.stringify(state)}::jsonb),
      now(),
      now()
    )
    on conflict (tenant_id)
    do update set
      config_json = jsonb_set(
        coalesce(tenant_config.config_json, '{}'::jsonb),
        '{insightAlerts}',
        ${JSON.stringify(state)}::jsonb
      ),
      updated_at = now()
  `;
}

export async function loadInsightLayoutStateJson(tx: TenantTx): Promise<unknown> {
  const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
    select config_json
    from tenant_config
    limit 1
  `;
  const config = rows[0]?.config_json;
  if (!config || typeof config !== "object") return null;
  return (config as Record<string, unknown>)["insightLayouts"] ?? null;
}

export async function saveInsightLayoutStateJson(tx: TenantTx, state: unknown): Promise<void> {
  await tx.$executeRaw`
    insert into tenant_config (
      id,
      tenant_id,
      config_json,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      app.current_tenant_id(),
      jsonb_build_object('insightLayouts', ${JSON.stringify(state)}::jsonb),
      now(),
      now()
    )
    on conflict (tenant_id)
    do update set
      config_json = jsonb_set(
        coalesce(tenant_config.config_json, '{}'::jsonb),
        '{insightLayouts}',
        ${JSON.stringify(state)}::jsonb
      ),
      updated_at = now()
  `;
}

export async function loadInsightDigestStateJson(tx: TenantTx): Promise<unknown> {
  const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
    select config_json
    from tenant_config
    limit 1
  `;
  const config = rows[0]?.config_json;
  if (!config || typeof config !== "object") return null;
  return (config as Record<string, unknown>)["insightDigests"] ?? null;
}

export async function saveInsightDigestStateJson(tx: TenantTx, state: unknown): Promise<void> {
  await tx.$executeRaw`
    insert into tenant_config (
      id,
      tenant_id,
      config_json,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      app.current_tenant_id(),
      jsonb_build_object('insightDigests', ${JSON.stringify(state)}::jsonb),
      now(),
      now()
    )
    on conflict (tenant_id)
    do update set
      config_json = jsonb_set(
        coalesce(tenant_config.config_json, '{}'::jsonb),
        '{insightDigests}',
        ${JSON.stringify(state)}::jsonb
      ),
      updated_at = now()
  `;
}

export async function loadMembershipEmail(
  tx: TenantTx,
  membershipId: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ email: string | null }>>`
    select coalesce(ap.email, m.invited_email_normalized) as email
    from memberships m
    left join auth_principals ap on ap.id = m.auth_principal_id
    where m.id = ${membershipId}::uuid
    limit 1
  `;
  const email = rows[0]?.email?.trim().toLowerCase() ?? "";
  return email.includes("@") ? email : null;
}

export async function loadTenantEmailDomains(tx: TenantTx): Promise<string[]> {
  const rows = await tx.$queryRaw<Array<{ hostname: string }>>`
    select hostname
    from tenant_domains
    where deleted_at is null
      and status = 'ACTIVE'
    order by is_primary desc, hostname asc
  `;
  return rows
    .map((row) => {
      const host = row.hostname.toLowerCase().replace(/^www\./, "");
      const parts = host.split(".").filter(Boolean);
      if (parts.length >= 2) return parts.slice(-2).join(".");
      return host;
    })
    .filter(Boolean);
}

export async function loadTenantAcademyName(tx: TenantTx): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ name: string | null }>>`
    select coalesce(public_name, display_name) as name
    from tenant_branding
    limit 1
  `;
  const name = rows[0]?.name?.trim() ?? "";
  return name.length > 0 ? name : "Insights";
}

export async function loadMembershipDisplayName(
  tx: TenantTx,
  membershipId: string,
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ name: string | null }>>`
    select coalesce(mp.display_name, ap.email, m.invited_email_normalized, 'Operator') as name
    from memberships m
    left join member_profiles mp
      on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
    left join auth_principals ap on ap.id = m.auth_principal_id
    where m.id = ${membershipId}::uuid
    limit 1
  `;
  return rows[0]?.name ?? "Operator";
}

export async function loadInsightSettingsJson(tx: TenantTx): Promise<unknown> {
  const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
    select config_json
    from tenant_config
    limit 1
  `;
  const config = rows[0]?.config_json;
  if (!config || typeof config !== "object") return null;
  return (config as Record<string, unknown>)["insightSettings"] ?? null;
}

export async function saveInsightSettingsJson(tx: TenantTx, state: unknown): Promise<void> {
  await tx.$executeRaw`
    insert into tenant_config (
      id,
      tenant_id,
      config_json,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      app.current_tenant_id(),
      jsonb_build_object('insightSettings', ${JSON.stringify(state)}::jsonb),
      now(),
      now()
    )
    on conflict (tenant_id)
    do update set
      config_json = jsonb_set(
        coalesce(tenant_config.config_json, '{}'::jsonb),
        '{insightSettings}',
        ${JSON.stringify(state)}::jsonb
      ),
      updated_at = now()
  `;
}

export async function loadInsightDisplayCurrency(tx: TenantTx): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ currency: string | null }>>`
    select coalesce(
      (select nullif(po.currency, '') from payment_orders po where po.status = 'paid' limit 1),
      (select nullif(c.metadata_json->>'currency', '') from courses c where c.deleted_at is null limit 1),
      'INR'
    ) as currency
  `;
  return rows[0]?.currency?.trim() || "INR";
}

export async function loadInsightViewerRoles(
  tx: TenantTx,
): Promise<Array<{ key: string; name: string; memberCount: number }>> {
  const rows = await tx.$queryRaw<Array<{ key: string; name: string; member_count: number }>>`
    select
      r.key,
      r.name,
      count(distinct ur.membership_id)::int as member_count
    from roles r
    inner join role_permissions rp
      on rp.role_id = r.id
      and rp.permission_key = 'insights.view'
    left join user_roles ur on ur.role_id = r.id
    left join memberships m
      on m.id = ur.membership_id
      and m.status = 'ACTIVE'
    where r.deleted_at is null
    group by r.key, r.name
    order by r.name asc
  `;
  return rows.map((row) => ({
    key: row.key,
    name: row.name,
    memberCount: row.member_count,
  }));
}
