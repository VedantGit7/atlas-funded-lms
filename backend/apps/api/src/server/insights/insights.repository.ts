import type { TenantTx } from "@atlas/db";

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
  productCount: number;
  learnerCount: number;
  enrollmentCount: number;
  currentMau: number;
  activeUsers30d: number;
  paidEnrollmentCount: number;
  freeEnrollmentCount: number;
  paymentStatusCounts: Array<{ status: string; count: number; amountCents: number }>;
  monthlyPaymentRevenue: Array<{ period: string; amountCents: number }>;
  monthlyEnrollments: Array<{ period: string; paid: number; free: number }>;
  topProducts: Array<{
    id: string;
    title: string;
    studentCount: number;
    revenueEstimateCents: number;
  }>;
  recentFailedPayments: Array<{
    id: string;
    learnerName: string | null;
    productTitle: string | null;
    amountCents: number;
    currency: string;
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

/** Commerce + ops snapshot for Insights → Dashboard (Learnyst-style overview). */
export async function loadInsightDashboardSnapshot(
  tx: TenantTx,
): Promise<InsightDashboardSnapshot> {
  const [
    kpiRows,
    mauRows,
    paymentStatusRows,
    monthlyPaymentRows,
    monthlyEnrollmentRows,
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
    tx.$queryRaw<Array<{ current_mau: number; active_users_30d: number }>>`
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
        ) as active_users_30d
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
    tx.$queryRaw<Array<{ period: string; paid: bigint; free: bigint }>>`
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
      months as (
        select generate_series(
          date_trunc('month', now()) - interval '11 months',
          date_trunc('month', now()),
          interval '1 month'
        ) as month
      )
      select
        to_char(m.month, 'YYYY-MM-DD') as period,
        coalesce(sum(case when cp.price_cents > 0 then 1 else 0 end), 0)::bigint as paid,
        coalesce(sum(case when cp.price_cents = 0 then 1 else 0 end), 0)::bigint as free
      from months m
      left join enrollments e
        on e.status = 'active'
        and date_trunc('month', e.enrolled_at) = m.month
      left join course_pricing cp on cp.id = e.course_id
      group by m.month
      order by m.month asc
    `,
    tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        student_count: bigint;
        revenue_estimate_cents: bigint;
      }>
    >`
      select
        c.id::text as id,
        c.title,
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
        created_at: Date;
      }>
    >`
      select
        po.id::text as id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        po.product_title,
        po.amount_cents,
        po.currency,
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
    tx.$queryRaw<
      Array<{ id: string; title: string; status: string; scheduled_at: Date | null }>
    >`
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
    tx.$queryRaw<
      Array<{ id: string; name: string; status: string; starts_at: Date }>
    >`
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

  return {
    currency: kpi?.currency?.trim() || "INR",
    enrollmentValueCents: asNumber(kpi?.enrollment_value_cents),
    paidPaymentRevenueCents: asNumber(kpi?.paid_payment_revenue_cents),
    productCount: asNumber(kpi?.product_count),
    learnerCount: asNumber(kpi?.learner_count),
    enrollmentCount: asNumber(kpi?.enrollment_count),
    currentMau: mau?.current_mau ?? 0,
    activeUsers30d: mau?.active_users_30d ?? 0,
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
    topProducts: topProductRows.map((row) => ({
      id: row.id,
      title: row.title,
      studentCount: asNumber(row.student_count),
      revenueEstimateCents: asNumber(row.revenue_estimate_cents),
    })),
    recentFailedPayments: failedPaymentRows.map((row) => ({
      id: row.id,
      learnerName: row.learner_name,
      productTitle: row.product_title,
      amountCents: row.amount_cents,
      currency: row.currency,
      createdAt: row.created_at.toISOString(),
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
  const span = Math.max(1, Math.min(rangeDays, 90));

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
  const to =
    bound?.to_day instanceof Date
      ? bound.to_day.toISOString().slice(0, 10)
      : from;

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
export async function loadSchoolVitalsSnapshot(tx: TenantTx): Promise<SchoolVitalsSnapshot> {
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
          current_date - 29,
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
            and lp.completed_at >= now() - interval '30 days'
        )::bigint as completions_30d,
        count(distinct lp.membership_id) filter (
          where lp.last_seen_at is not null
            and lp.last_seen_at >= now() - interval '30 days'
        )::bigint as active_learners,
        coalesce(avg(lp.progress_pct) filter (
          where lp.last_seen_at is not null
            and lp.last_seen_at >= now() - interval '30 days'
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
            and lp.completed_at >= now() - interval '30 days'
        ) > 0
        or count(distinct lp.membership_id) filter (
          where lp.last_seen_at is not null
            and lp.last_seen_at >= now() - interval '30 days'
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
      avgProgressPct: Math.round(Number(row.avg_progress_pct) || 0),
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
        created_at: Date;
      }>
    >`
      select
        po.id::text as id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        po.product_title,
        po.amount_cents,
        po.currency,
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
      tx.$queryRaw<
        Array<{ status: string; session_count: bigint; attended_count: bigint }>
      >`
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
    tx.$queryRaw<
      Array<{ id: string; title: string; status: string; submissions: bigint }>
    >`
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
  const [
    kpiRows,
    dailyRows,
    emailRows,
    pushRows,
    whatsappRows,
    announcementRows,
  ] = await Promise.all([
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
      limit 8
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
    return parts.length > 0 ? parts.join(", ") : "—";
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
