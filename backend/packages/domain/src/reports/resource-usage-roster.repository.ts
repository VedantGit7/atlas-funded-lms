import type { TenantTx } from "@atlas/db";
import type {
  ResourceUsageDormantQuery,
  ResourceUsageHistoryQuery,
  ResourceUsageInactiveQuery,
} from "./resource-usage-roster.dto";

const USAGE_HISTORY_KEYS = [
  "usage.storage_gb",
  "usage.total_learners",
  "usage.products",
  "usage.questions",
  "usage.test_submits",
  "usage.message_sends",
  "usage.email_validations",
] as const;

const METRIC_LABELS: Record<string, string> = {
  "usage.storage_gb": "Storage",
  "usage.total_learners": "Total learners",
  "usage.products": "Products",
  "usage.questions": "Questions",
  "usage.test_submits": "Tests taken",
  "usage.message_sends": "Message sends",
  "usage.email_validations": "Email validations",
};

const METRIC_UNITS: Record<string, string> = {
  "usage.storage_gb": "GB",
  "usage.total_learners": "count",
  "usage.products": "count",
  "usage.questions": "count",
  "usage.test_submits": "count",
  "usage.message_sends": "count",
  "usage.email_validations": "count",
};

export type ResourceUsageMeters = {
  storageGb: number;
  activeUsers30d: number;
  currentMau: number;
  totalLearners: number;
  testSubmits: number;
  products: number;
  questions: number;
  messageSends: number;
  bandwidthGb: number;
  drmTokens: number;
  videoTranscodingHours: number;
};

export type ResourceUsageOptimizationCounts = {
  dormantContentCount: number;
  inactiveLearnerCount: number;
  dormantStorageGb: number;
};

export type ResourceUsageLimits = {
  storageGb: number | null;
  mau: number | null;
};

export type ResourceUsageStorageTrend = {
  sparkline: number[];
  deltaGb: number;
};

export type ResourceUsageHistoryRow = {
  metric_key: string;
  metric_label: string;
  period: string;
  value: number;
  unit: string;
  previous_value: number | null;
  change_absolute: number | null;
  change_percent: number | null;
  calculated_at: Date | null;
};

export type ResourceUsageHistorySeriesRow = {
  metric_key: string;
  metric_label: string;
  unit: string;
  points: Array<{ period: string; value: number; change_absolute: number | null }>;
};

export type ResourceUsageHistorySummary = {
  totalRecords: number;
  metricsTracked: number;
  metersAvailable: number;
  periodsRecorded: number;
  earliestPeriod: string | null;
  latestPeriod: string | null;
  lastCalculatedAt: Date | null;
  largestMovement: {
    metricKey: string;
    metricLabel: string;
    unit: string;
    changeAbsolute: number;
    period: string;
  } | null;
  smallestMovement: {
    metricKey: string;
    metricLabel: string;
    unit: string;
    changeAbsolute: number;
    period: string;
  } | null;
};

export type ResourceUsageDormantRow = {
  course_id: string;
  title: string;
  status: string;
  lesson_count: number;
  storage_gb: number;
  active_enrolment_count: number;
  inactive_enrolment_count: number;
  last_learner_activity_at: Date | null;
  dormant_days: number;
  created_at: Date | null;
};

export type ResourceUsageDormantSummaryRow = {
  dormant_course_count: number;
  total_course_count: number;
  storage_held_gb: number;
  total_storage_gb: number;
  unpublished_dormant_count: number;
  longest_dormant_days: number | null;
  longest_dormant_course_id: string | null;
  longest_dormant_title: string | null;
  lessons_affected: number;
  view_all: number;
  view_unpublished: number;
  view_large: number;
  view_never_opened: number;
};

export type ResourceUsageInactiveRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  status: string;
  activity_label: "inactive" | "dormant" | "never_active";
  enrolment_count: number;
  last_active_at: Date | null;
  inactive_days: number;
  created_at: Date;
  has_paid: boolean;
};

export type ResourceUsageInactiveSummaryRow = {
  inactive_learner_count: number;
  total_learner_count: number;
  never_active_count: number;
  inactive_over_year_count: number;
  enrolments_held: number;
  paid_among_them: number;
  view_all: number;
  view_never_active: number;
  view_paid_holding: number;
};

function roundGb(value: number): number {
  return Math.round(value * 100) / 100;
}

function readNumericLimit(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "object" && value !== null && "limit" in value) {
    const limit: unknown = value.limit;
    if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
      return limit;
    }
  }
  return null;
}

/** Plan-tier defaults mirrored from usage insights (entitlement override wins). */
function planTierDefaults(planName: string | null): ResourceUsageLimits {
  const normalized = (planName ?? "").toLowerCase();
  if (normalized.includes("enterprise")) {
    return { storageGb: null, mau: null };
  }
  if (normalized.includes("professional")) {
    return { storageGb: 100, mau: 1000 };
  }
  if (normalized.includes("growth")) {
    return { storageGb: 50, mau: 500 };
  }
  return { storageGb: 10, mau: 100 };
}

export const resourceUsageRosterRepository = {
  async getMeters(tx: TenantTx): Promise<ResourceUsageMeters> {
    const rows = await tx.$queryRaw<
      Array<{
        current_mau: number;
        active_users_30d: number;
        total_learners: number;
        storage_gb: number;
        products: number;
        questions: number;
        test_submits: number;
        message_sends: number;
      }>
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
          select count(distinct m.id)::int
          from memberships m
          join user_roles ur on ur.membership_id = m.id
          join roles r on r.id = ur.role_id and r.key = 'learner'
          where m.status = 'ACTIVE'
        ) as total_learners,
        (
          select coalesce(sum(size_bytes), 0)::float8 / 1e9
          from storage_references
          where deleted_at is null
        ) as storage_gb,
        (
          select count(*)::int
          from courses
          where status = 'PUBLISHED' and deleted_at is null
        ) as products,
        (
          select count(*)::int
          from items
          where deleted_at is null
        ) as questions,
        (
          select count(*)::int
          from attempts
          where submitted_at is not null
        ) as test_submits,
        (
          select coalesce((metrics_json->>'count')::int, 0)::int
          from analytics_rollups
          where rollup_key = 'usage.message_sends'
            and period_start = date_trunc('month', now())
          limit 1
        ) as message_sends
    `;

    const row = rows[0];
    return {
      storageGb: roundGb(row?.storage_gb ?? 0),
      activeUsers30d: row?.active_users_30d ?? 0,
      currentMau: row?.current_mau ?? 0,
      totalLearners: row?.total_learners ?? 0,
      testSubmits: row?.test_submits ?? 0,
      products: row?.products ?? 0,
      questions: row?.questions ?? 0,
      messageSends: row?.message_sends ?? 0,
      // Tier-B: not metered yet (CDN/DRM/transcoding pipelines).
      bandwidthGb: 0,
      drmTokens: 0,
      videoTranscodingHours: 0,
    };
  },

  async getOptimizationCounts(tx: TenantTx): Promise<ResourceUsageOptimizationCounts> {
    const rows = await tx.$queryRaw<
      Array<{
        dormant_content_count: number;
        dormant_storage_gb: number;
        inactive_learner_count: number;
      }>
    >`
      with course_activity as (
        select
          c.id as course_id,
          max(lp.last_seen_at) as last_activity_at,
          coalesce((
            select sum(sr.size_bytes)::float8 / 1e9
            from storage_references sr
            where sr.deleted_at is null
              and (
                (sr.resource_type = 'course' and sr.resource_id = c.id)
                or (
                  sr.resource_type = 'course_module'
                  and sr.resource_id in (
                    select cm.id from course_modules cm
                    where cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
                  )
                )
                or (
                  sr.resource_type = 'lesson'
                  and sr.resource_id in (
                    select l.id from lessons l
                    join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                    where cm.course_id = c.id and l.tenant_id = c.tenant_id and l.deleted_at is null
                      and cm.deleted_at is null
                  )
                )
              )
          ), 0) as storage_gb
        from courses c
        left join course_modules cm
          on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
        left join lessons l
          on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
        left join lesson_progress lp
          on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
          and c.status = 'PUBLISHED'
        group by c.id
      )
      select
        (
          select count(*)::int
          from course_activity
          where last_activity_at is null
             or last_activity_at < now() - interval '30 days'
        ) as dormant_content_count,
        (
          select coalesce(sum(storage_gb), 0)::float8
          from course_activity
          where last_activity_at is null
             or last_activity_at < now() - interval '30 days'
        ) as dormant_storage_gb,
        (
          select count(distinct m.id)::int
          from memberships m
          join user_roles ur on ur.membership_id = m.id
          join roles r on r.id = ur.role_id and r.key = 'learner'
          where m.tenant_id = current_setting('app.tenant_id', true)::uuid
            and m.status = 'ACTIVE'
            and (m.last_active_at is null or m.last_active_at < now() - interval '90 days')
        ) as inactive_learner_count
    `;

    const row = rows[0];
    return {
      dormantContentCount: row?.dormant_content_count ?? 0,
      inactiveLearnerCount: row?.inactive_learner_count ?? 0,
      dormantStorageGb: roundGb(row?.dormant_storage_gb ?? 0),
    };
  },

  async getLimits(tx: TenantTx): Promise<ResourceUsageLimits> {
    const [planRows, entitlementRows] = await Promise.all([
      tx.$queryRaw<Array<{ plan_name: string }>>`
        select plan_name
        from tenant_subscriptions
        order by created_at desc
        limit 1
      `,
      tx.$queryRaw<Array<{ key: string; value: unknown }>>`
        select key, value_json as value
        from entitlements
        where key in ('usage.limit.storage_gb', 'usage.limit.mau')
          and starts_at <= now()
          and (expires_at is null or expires_at > now())
      `,
    ]);

    const defaults = planTierDefaults(planRows[0]?.plan_name ?? null);
    const byKey = new Map(entitlementRows.map((row) => [row.key, row.value]));
    return {
      storageGb: readNumericLimit(byKey.get("usage.limit.storage_gb")) ?? defaults.storageGb,
      mau: readNumericLimit(byKey.get("usage.limit.mau")) ?? defaults.mau,
    };
  },

  async getStorageTrend(
    tx: TenantTx,
    currentStorageGb: number,
    period: "this_month" | "last_month" | "ytd" = "this_month",
  ): Promise<ResourceUsageStorageTrend> {
    const rows = await tx.$queryRaw<Array<{ period: string; value: number }>>`
      select
        to_char(date_trunc('month', period_start), 'YYYY-MM-DD') as period,
        coalesce((metrics_json->>'value')::float8, 0) as value
      from analytics_rollups
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and rollup_key = 'usage.storage_gb'
        and period_start >= date_trunc('month', now()) - interval '11 months'
      order by period_start asc
    `;

    const byPeriod = new Map(rows.map((row) => [row.period, roundGb(row.value)]));
    const sparkline: number[] = [];
    const now = new Date();
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
      const key = `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
      if (offset === 0) {
        sparkline.push(currentStorageGb);
      } else {
        sparkline.push(byPeriod.get(key) ?? 0);
      }
    }

    const current = sparkline[sparkline.length - 1] ?? currentStorageGb;
    let baseline = sparkline.length >= 2 ? (sparkline[sparkline.length - 2] ?? 0) : 0;
    if (period === "last_month") {
      const lastMonth = sparkline.length >= 2 ? (sparkline[sparkline.length - 2] ?? 0) : 0;
      const twoMonthsAgo = sparkline.length >= 3 ? (sparkline[sparkline.length - 3] ?? 0) : 0;
      return {
        sparkline,
        deltaGb: roundGb(lastMonth - twoMonthsAgo),
      };
    }
    if (period === "ytd") {
      const janKey = `${String(now.getUTCFullYear())}-01-01`;
      baseline = byPeriod.get(janKey) ?? sparkline[0] ?? 0;
    }

    return {
      sparkline,
      deltaGb: roundGb(current - baseline),
    };
  },

  async countHistory(tx: TenantTx, query: ResourceUsageHistoryQuery): Promise<number> {
    const metricKey = query.metricKey ?? null;
    const keys = [...USAGE_HISTORY_KEYS];
    const lookbackMonths = Math.max(0, query.rangeMonths - 1);
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from analytics_rollups ar
      where ar.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ar.rollup_key = any(${keys}::text[])
        and (${metricKey}::text is null or ar.rollup_key = ${metricKey})
        and ar.period_start >= date_trunc('month', now()) - make_interval(months => ${lookbackMonths})
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listHistory(
    tx: TenantTx,
    query: ResourceUsageHistoryQuery,
  ): Promise<ResourceUsageHistoryRow[]> {
    const metricKey = query.metricKey ?? null;
    const keys = [...USAGE_HISTORY_KEYS];
    const offset = (query.page - 1) * query.limit;
    const lookbackMonths = Math.max(0, query.rangeMonths - 1);
    const sort = query.sort;

    const rows = await tx.$queryRaw<
      Array<{
        rollup_key: string;
        period: string;
        value: number;
        previous_value: number | null;
        calculated_at: Date | null;
      }>
    >`
      with base as (
        select
          ar.rollup_key,
          to_char(date_trunc('month', ar.period_start), 'YYYY-MM-DD') as period,
          ar.period_start,
          ar.metrics_json,
          ar.calculated_at,
          case
            when ar.rollup_key in ('usage.message_sends', 'usage.email_validations')
              then coalesce((ar.metrics_json->>'count')::float8, 0)
            else coalesce((ar.metrics_json->>'value')::float8, 0)
          end as value
        from analytics_rollups ar
        where ar.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ar.rollup_key = any(${keys}::text[])
          and (${metricKey}::text is null or ar.rollup_key = ${metricKey})
          and ar.period_start >= date_trunc('month', now()) - make_interval(months => ${lookbackMonths})
      ),
      with_prev as (
        select
          rollup_key,
          period,
          value,
          calculated_at,
          lag(value) over (partition by rollup_key order by period_start) as previous_value
        from base
      )
      select
        rollup_key,
        period,
        value,
        previous_value,
        calculated_at
      from with_prev
      order by
        case when ${sort}::text = 'oldest' then period end asc nulls last,
        case when ${sort}::text = 'newest' then period end desc nulls last,
        case
          when ${sort}::text = 'highest_delta'
            then abs(coalesce(value - previous_value, 0))
        end desc nulls last,
        rollup_key asc
      limit ${query.limit} offset ${offset}
    `;

    return rows.map((row) => {
      const previous = row.previous_value;
      const changeAbsolute =
        previous == null ? null : Math.round((row.value - previous) * 100) / 100;
      const changePercent =
        previous == null || previous === 0
          ? null
          : Math.round(((row.value - previous) / Math.abs(previous)) * 1000) / 10;
      return {
        metric_key: row.rollup_key,
        metric_label: METRIC_LABELS[row.rollup_key] ?? row.rollup_key,
        period: row.period,
        value: row.value,
        unit: METRIC_UNITS[row.rollup_key] ?? "count",
        previous_value: previous == null ? null : previous,
        change_absolute: changeAbsolute,
        change_percent: changePercent,
        calculated_at: row.calculated_at,
      };
    });
  },

  async getHistorySeries(
    tx: TenantTx,
    query: ResourceUsageHistoryQuery,
  ): Promise<ResourceUsageHistorySeriesRow[]> {
    const metricKey = query.metricKey ?? null;
    const keys = metricKey ? [metricKey] : [...USAGE_HISTORY_KEYS].slice(0, 4);
    const lookbackMonths = Math.max(0, Math.min(query.rangeMonths, 12) - 1);

    const rows = await tx.$queryRaw<
      Array<{
        rollup_key: string;
        period: string;
        value: number;
        previous_value: number | null;
      }>
    >`
      with base as (
        select
          ar.rollup_key,
          to_char(date_trunc('month', ar.period_start), 'YYYY-MM-DD') as period,
          ar.period_start,
          case
            when ar.rollup_key in ('usage.message_sends', 'usage.email_validations')
              then coalesce((ar.metrics_json->>'count')::float8, 0)
            else coalesce((ar.metrics_json->>'value')::float8, 0)
          end as value
        from analytics_rollups ar
        where ar.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ar.rollup_key = any(${keys}::text[])
          and ar.period_start >= date_trunc('month', now()) - make_interval(months => ${lookbackMonths})
      )
      select
        rollup_key,
        period,
        value,
        lag(value) over (partition by rollup_key order by period_start) as previous_value
      from base
      order by rollup_key asc, period_start asc
    `;

    const byKey = new Map<string, ResourceUsageHistorySeriesRow>();
    for (const row of rows) {
      let series = byKey.get(row.rollup_key);
      if (!series) {
        series = {
          metric_key: row.rollup_key,
          metric_label: METRIC_LABELS[row.rollup_key] ?? row.rollup_key,
          unit: METRIC_UNITS[row.rollup_key] ?? "count",
          points: [],
        };
        byKey.set(row.rollup_key, series);
      }
      const changeAbsolute =
        row.previous_value == null
          ? null
          : Math.round((row.value - row.previous_value) * 100) / 100;
      series.points.push({
        period: row.period,
        value: row.value,
        change_absolute: changeAbsolute,
      });
    }
    return [...byKey.values()];
  },

  async getHistorySummary(
    tx: TenantTx,
    query: ResourceUsageHistoryQuery,
  ): Promise<ResourceUsageHistorySummary> {
    const metricKey = query.metricKey ?? null;
    const keys = [...USAGE_HISTORY_KEYS];
    const lookbackMonths = Math.max(0, query.rangeMonths - 1);

    const [aggregateRows, movementRows] = await Promise.all([
      tx.$queryRaw<
        Array<{
          total_records: number;
          metrics_tracked: number;
          periods_recorded: number;
          earliest_period: string | null;
          latest_period: string | null;
          last_calculated_at: Date | null;
        }>
      >`
        select
          count(*)::int as total_records,
          count(distinct ar.rollup_key)::int as metrics_tracked,
          count(distinct date_trunc('month', ar.period_start))::int as periods_recorded,
          min(to_char(date_trunc('month', ar.period_start), 'YYYY-MM-DD')) as earliest_period,
          max(to_char(date_trunc('month', ar.period_start), 'YYYY-MM-DD')) as latest_period,
          max(ar.calculated_at) as last_calculated_at
        from analytics_rollups ar
        where ar.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ar.rollup_key = any(${keys}::text[])
          and (${metricKey}::text is null or ar.rollup_key = ${metricKey})
          and ar.period_start >= date_trunc('month', now()) - make_interval(months => ${lookbackMonths})
      `,
      tx.$queryRaw<
        Array<{
          rollup_key: string;
          period: string;
          change_absolute: number;
        }>
      >`
        with base as (
          select
            ar.rollup_key,
            to_char(date_trunc('month', ar.period_start), 'YYYY-MM-DD') as period,
            ar.period_start,
            case
              when ar.rollup_key in ('usage.message_sends', 'usage.email_validations')
                then coalesce((ar.metrics_json->>'count')::float8, 0)
              else coalesce((ar.metrics_json->>'value')::float8, 0)
            end as value
          from analytics_rollups ar
          where ar.tenant_id = current_setting('app.tenant_id', true)::uuid
            and ar.rollup_key = any(${keys}::text[])
            and (${metricKey}::text is null or ar.rollup_key = ${metricKey})
            and ar.period_start >= date_trunc('month', now()) - make_interval(months => ${lookbackMonths})
        ),
        with_delta as (
          select
            rollup_key,
            period,
            value - lag(value) over (partition by rollup_key order by period_start) as change_absolute
          from base
        )
        select rollup_key, period, change_absolute
        from with_delta
        where change_absolute is not null
        order by abs(change_absolute) desc
        limit 50
      `,
    ]);

    const aggregate = aggregateRows[0];
    const largest = movementRows[0] ?? null;
    const smallest =
      movementRows.length > 0
        ? ([...movementRows].sort(
            (a, b) => Math.abs(a.change_absolute) - Math.abs(b.change_absolute),
          )[0] ?? null)
        : null;

    return {
      totalRecords: aggregate?.total_records ?? 0,
      metricsTracked: aggregate?.metrics_tracked ?? 0,
      metersAvailable: USAGE_HISTORY_KEYS.length,
      periodsRecorded: aggregate?.periods_recorded ?? 0,
      earliestPeriod: aggregate?.earliest_period ?? null,
      latestPeriod: aggregate?.latest_period ?? null,
      lastCalculatedAt: aggregate?.last_calculated_at ?? null,
      largestMovement: largest
        ? {
            metricKey: largest.rollup_key,
            metricLabel: METRIC_LABELS[largest.rollup_key] ?? largest.rollup_key,
            unit: METRIC_UNITS[largest.rollup_key] ?? "count",
            changeAbsolute: Math.round(largest.change_absolute * 100) / 100,
            period: largest.period,
          }
        : null,
      smallestMovement: smallest
        ? {
            metricKey: smallest.rollup_key,
            metricLabel: METRIC_LABELS[smallest.rollup_key] ?? smallest.rollup_key,
            unit: METRIC_UNITS[smallest.rollup_key] ?? "count",
            changeAbsolute: Math.round(smallest.change_absolute * 100) / 100,
            period: smallest.period,
          }
        : null,
    };
  },

  async countDormant(tx: TenantTx, query: ResourceUsageDormantQuery): Promise<number> {
    const rows = await this.listDormantFiltered(tx, query, { countOnly: true });
    return Number(rows[0]?.["count"] ?? 0);
  },

  async listDormant(
    tx: TenantTx,
    query: ResourceUsageDormantQuery,
  ): Promise<ResourceUsageDormantRow[]> {
    const rows = await this.listDormantFiltered(tx, query, { countOnly: false });
    return rows.map((row) => ({
      course_id: String(row["course_id"]),
      title: String(row["title"]),
      status: String(row["status"]),
      lesson_count: Number(row["lesson_count"]),
      storage_gb: roundGb(Number(row["storage_gb"])),
      active_enrolment_count: Number(row["active_enrolment_count"]),
      inactive_enrolment_count: Number(row["inactive_enrolment_count"]),
      last_learner_activity_at: (row["last_learner_activity_at"] as Date | null) ?? null,
      dormant_days: Number(row["dormant_days"]),
      created_at: (row["created_at"] as Date | null) ?? null,
    }));
  },

  async listDormantFiltered(
    tx: TenantTx,
    query: ResourceUsageDormantQuery,
    opts: { countOnly: boolean },
  ): Promise<Array<Record<string, unknown>>> {
    const q = query.q ?? null;
    const dormantDays = query.dormantDays;
    const minLessons = query.minLessons;
    const includeUnpublished = query.includeUnpublished;
    const includeArchived = query.includeArchived;
    const status = query.status;
    const view = query.view;
    const dormantForMin = query.dormantForMin ?? null;
    const storageMinGb = query.storageMinGb ?? null;
    const enrolmentFilter = query.enrolmentFilter;
    const sort = query.sort;
    const offset = (query.page - 1) * query.limit;

    if (opts.countOnly) {
      return tx.$queryRaw<Array<Record<string, unknown>>>`
        with course_activity as (
          select
            c.id as course_id,
            c.title,
            c.status::text as status,
            c.created_at,
            count(distinct l.id)::int as lesson_count,
            max(lp.last_seen_at) as last_learner_activity_at,
            coalesce((
              select sum(sr.size_bytes)::float8 / 1e9
              from storage_references sr
              where sr.deleted_at is null
                and sr.tenant_id = c.tenant_id
                and (
                  (sr.resource_type = 'course' and sr.resource_id = c.id)
                  or (
                    sr.resource_type = 'course_module'
                    and sr.resource_id in (
                      select cm2.id from course_modules cm2
                      where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                    )
                  )
                  or (
                    sr.resource_type = 'lesson'
                    and sr.resource_id in (
                      select l2.id from lessons l2
                      join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                      where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                        and l2.deleted_at is null and cm3.deleted_at is null
                    )
                  )
                )
            ), 0) as storage_gb,
            coalesce((
              select count(*)::int from enrollments e
              where e.tenant_id = c.tenant_id and e.course_id = c.id and e.status = 'active'
            ), 0) as active_enrolment_count,
            coalesce((
              select count(*)::int from enrollments e
              where e.tenant_id = c.tenant_id and e.course_id = c.id and e.status <> 'active'
            ), 0) as inactive_enrolment_count
          from courses c
          left join course_modules cm
            on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
          left join lessons l
            on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
          left join lesson_progress lp
            on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
          where c.tenant_id = current_setting('app.tenant_id', true)::uuid
            and c.deleted_at is null
            and (
              c.status = 'PUBLISHED'
              or (${includeUnpublished}::boolean and c.status in ('DRAFT', 'REVIEW'))
              or (${includeArchived}::boolean and c.status = 'ARCHIVED')
            )
            and (
              ${q}::text is null
              or lower(c.title) like '%' || lower(${q}) || '%'
            )
          group by c.id, c.title, c.status, c.created_at
        ),
        dormant as (
          select
            *,
            greatest(
              0,
              floor(
                extract(
                  epoch from (
                    now() - coalesce(last_learner_activity_at, created_at, now())
                  )
                ) / 86400
              )
            )::int as dormant_days
          from course_activity
          where lesson_count >= ${minLessons}::int
            and (
              last_learner_activity_at is null
              or last_learner_activity_at < now() - make_interval(days => ${dormantDays}::int)
            )
        )
        select count(*)::bigint as count
        from dormant
        where (
            ${status}::text = 'all'
            or (${status}::text = 'published' and status = 'PUBLISHED')
            or (${status}::text = 'unpublished' and status in ('DRAFT', 'REVIEW'))
            or (${status}::text = 'archived' and status = 'ARCHIVED')
          )
          and (
            ${view}::text = 'all'
            or (${view}::text = 'unpublished' and status in ('DRAFT', 'REVIEW'))
            or (${view}::text = 'large' and storage_gb > 1)
            or (${view}::text = 'never_opened' and last_learner_activity_at is null)
          )
          and (${dormantForMin}::int is null or dormant_days >= ${dormantForMin}::int)
          and (${storageMinGb}::float8 is null or storage_gb >= ${storageMinGb}::float8)
          and (
            ${enrolmentFilter}::text = 'any'
            or (${enrolmentFilter}::text = 'zero_active' and active_enrolment_count = 0)
            or (${enrolmentFilter}::text = 'has_active' and active_enrolment_count > 0)
          )
      `;
    }

    return tx.$queryRaw<Array<Record<string, unknown>>>`
      with course_activity as (
        select
          c.id as course_id,
          c.title,
          c.status::text as status,
          c.created_at,
          count(distinct l.id)::int as lesson_count,
          max(lp.last_seen_at) as last_learner_activity_at,
          coalesce((
            select sum(sr.size_bytes)::float8 / 1e9
            from storage_references sr
            where sr.deleted_at is null
              and sr.tenant_id = c.tenant_id
              and (
                (sr.resource_type = 'course' and sr.resource_id = c.id)
                or (
                  sr.resource_type = 'course_module'
                  and sr.resource_id in (
                    select cm2.id from course_modules cm2
                    where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                  )
                )
                or (
                  sr.resource_type = 'lesson'
                  and sr.resource_id in (
                    select l2.id from lessons l2
                    join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                    where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                      and l2.deleted_at is null and cm3.deleted_at is null
                  )
                )
              )
          ), 0) as storage_gb,
          coalesce((
            select count(*)::int from enrollments e
            where e.tenant_id = c.tenant_id and e.course_id = c.id and e.status = 'active'
          ), 0) as active_enrolment_count,
          coalesce((
            select count(*)::int from enrollments e
            where e.tenant_id = c.tenant_id and e.course_id = c.id and e.status <> 'active'
          ), 0) as inactive_enrolment_count
        from courses c
        left join course_modules cm
          on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
        left join lessons l
          on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
        left join lesson_progress lp
          on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
          and (
            c.status = 'PUBLISHED'
            or (${includeUnpublished}::boolean and c.status in ('DRAFT', 'REVIEW'))
            or (${includeArchived}::boolean and c.status = 'ARCHIVED')
          )
          and (
            ${q}::text is null
            or lower(c.title) like '%' || lower(${q}) || '%'
          )
        group by c.id, c.title, c.status, c.created_at
      ),
      dormant as (
        select
          *,
          greatest(
            0,
            floor(
              extract(
                epoch from (
                  now() - coalesce(last_learner_activity_at, created_at, now())
                )
              ) / 86400
            )
          )::int as dormant_days
        from course_activity
        where lesson_count >= ${minLessons}::int
          and (
            last_learner_activity_at is null
            or last_learner_activity_at < now() - make_interval(days => ${dormantDays}::int)
          )
      )
      select
        course_id::text as course_id,
        title,
        status,
        lesson_count,
        storage_gb,
        active_enrolment_count,
        inactive_enrolment_count,
        last_learner_activity_at,
        dormant_days,
        created_at
      from dormant
      where (
          ${status}::text = 'all'
          or (${status}::text = 'published' and status = 'PUBLISHED')
          or (${status}::text = 'unpublished' and status in ('DRAFT', 'REVIEW'))
          or (${status}::text = 'archived' and status = 'ARCHIVED')
        )
        and (
          ${view}::text = 'all'
          or (${view}::text = 'unpublished' and status in ('DRAFT', 'REVIEW'))
          or (${view}::text = 'large' and storage_gb > 1)
          or (${view}::text = 'never_opened' and last_learner_activity_at is null)
        )
        and (${dormantForMin}::int is null or dormant_days >= ${dormantForMin}::int)
        and (${storageMinGb}::float8 is null or storage_gb >= ${storageMinGb}::float8)
        and (
          ${enrolmentFilter}::text = 'any'
          or (${enrolmentFilter}::text = 'zero_active' and active_enrolment_count = 0)
          or (${enrolmentFilter}::text = 'has_active' and active_enrolment_count > 0)
        )
      order by
        case when ${sort}::text = 'storage_desc' then storage_gb end desc nulls last,
        case when ${sort}::text = 'dormant_desc' then dormant_days end desc nulls last,
        case when ${sort}::text = 'lessons_desc' then lesson_count end desc nulls last,
        case when ${sort}::text = 'activity_asc' then last_learner_activity_at end asc nulls first,
        case when ${sort}::text = 'title_asc' then title end asc nulls last,
        storage_gb desc,
        title asc
      limit ${query.limit} offset ${offset}
    `;
  },

  async getDormantSummary(
    tx: TenantTx,
    query: ResourceUsageDormantQuery,
  ): Promise<ResourceUsageDormantSummaryRow> {
    const dormantDays = query.dormantDays;
    const minLessons = query.minLessons;
    const includeUnpublished = query.includeUnpublished;
    const includeArchived = query.includeArchived;

    const rows = await tx.$queryRaw<Array<ResourceUsageDormantSummaryRow>>`
      with scoped as (
        select
          c.id as course_id,
          c.title,
          c.status::text as status,
          c.created_at,
          count(distinct l.id)::int as lesson_count,
          max(lp.last_seen_at) as last_learner_activity_at,
          coalesce((
            select sum(sr.size_bytes)::float8 / 1e9
            from storage_references sr
            where sr.deleted_at is null
              and sr.tenant_id = c.tenant_id
              and (
                (sr.resource_type = 'course' and sr.resource_id = c.id)
                or (
                  sr.resource_type = 'course_module'
                  and sr.resource_id in (
                    select cm2.id from course_modules cm2
                    where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                  )
                )
                or (
                  sr.resource_type = 'lesson'
                  and sr.resource_id in (
                    select l2.id from lessons l2
                    join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                    where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                      and l2.deleted_at is null and cm3.deleted_at is null
                  )
                )
              )
          ), 0) as storage_gb
        from courses c
        left join course_modules cm
          on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
        left join lessons l
          on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
        left join lesson_progress lp
          on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
          and (
            c.status = 'PUBLISHED'
            or (${includeUnpublished}::boolean and c.status in ('DRAFT', 'REVIEW'))
            or (${includeArchived}::boolean and c.status = 'ARCHIVED')
          )
        group by c.id, c.title, c.status, c.created_at
      ),
      dormant as (
        select
          *,
          greatest(
            0,
            floor(
              extract(
                epoch from (
                  now() - coalesce(last_learner_activity_at, created_at, now())
                )
              ) / 86400
            )
          )::int as dormant_days
        from scoped
        where lesson_count >= ${minLessons}::int
          and (
            last_learner_activity_at is null
            or last_learner_activity_at < now() - make_interval(days => ${dormantDays}::int)
          )
      ),
      totals as (
        select
          count(*)::int as total_course_count,
          coalesce(sum(storage_gb), 0)::float8 as total_storage_gb
        from scoped
      )
      select
        (select count(*)::int from dormant) as dormant_course_count,
        (select total_course_count from totals) as total_course_count,
        coalesce((select sum(storage_gb) from dormant), 0)::float8 as storage_held_gb,
        (select total_storage_gb from totals) as total_storage_gb,
        (
          select count(*)::int from dormant where status in ('DRAFT', 'REVIEW')
        ) as unpublished_dormant_count,
        (select max(dormant_days) from dormant) as longest_dormant_days,
        (
          select course_id::text from dormant order by dormant_days desc, storage_gb desc limit 1
        ) as longest_dormant_course_id,
        (
          select title from dormant order by dormant_days desc, storage_gb desc limit 1
        ) as longest_dormant_title,
        coalesce((select sum(lesson_count) from dormant), 0)::int as lessons_affected,
        (select count(*)::int from dormant) as view_all,
        (
          select count(*)::int from dormant where status in ('DRAFT', 'REVIEW')
        ) as view_unpublished,
        (select count(*)::int from dormant where storage_gb > 1) as view_large,
        (
          select count(*)::int from dormant where last_learner_activity_at is null
        ) as view_never_opened
    `;

    const row = rows[0];
    return {
      dormant_course_count: row?.dormant_course_count ?? 0,
      total_course_count: row?.total_course_count ?? 0,
      storage_held_gb: roundGb(row?.storage_held_gb ?? 0),
      total_storage_gb: roundGb(row?.total_storage_gb ?? 0),
      unpublished_dormant_count: row?.unpublished_dormant_count ?? 0,
      longest_dormant_days: row?.longest_dormant_days == null ? null : row.longest_dormant_days,
      longest_dormant_course_id: row?.longest_dormant_course_id ?? null,
      longest_dormant_title: row?.longest_dormant_title ?? null,
      lessons_affected: row?.lessons_affected ?? 0,
      view_all: row?.view_all ?? 0,
      view_unpublished: row?.view_unpublished ?? 0,
      view_large: row?.view_large ?? 0,
      view_never_opened: row?.view_never_opened ?? 0,
    };
  },

  async archiveDormantCourses(
    tx: TenantTx,
    args: {
      courseIds: string[];
      action: "archive" | "unpublish";
      deleteAssets: boolean;
    },
  ): Promise<{
    processedIds: string[];
    skippedIds: string[];
    deletedAssetsGb: number;
  }> {
    const processedIds: string[] = [];
    const skippedIds: string[] = [];
    let deletedAssetsGb = 0;

    for (const courseId of args.courseIds) {
      const existing = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        select id::text as id, status::text as status
        from courses
        where id = ${courseId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
          and deleted_at is null
        limit 1
      `;
      if (!existing[0] || existing[0].status === "ARCHIVED") {
        skippedIds.push(courseId);
        continue;
      }

      if (args.action === "archive") {
        await tx.$executeRaw`
          update courses
          set status = 'ARCHIVED'::"PublishStatus", updated_at = now()
          where id = ${courseId}::uuid
            and tenant_id = current_setting('app.tenant_id', true)::uuid
            and deleted_at is null
        `;
      } else {
        await tx.$executeRaw`
          update courses
          set status = 'DRAFT'::"PublishStatus", updated_at = now()
          where id = ${courseId}::uuid
            and tenant_id = current_setting('app.tenant_id', true)::uuid
            and deleted_at is null
            and status <> 'ARCHIVED'::"PublishStatus"
        `;
      }

      if (args.deleteAssets && args.action === "archive") {
        const sizeRows = await tx.$queryRaw<Array<{ storage_gb: number }>>`
          select coalesce(sum(sr.size_bytes), 0)::float8 / 1e9 as storage_gb
          from storage_references sr
          where sr.tenant_id = current_setting('app.tenant_id', true)::uuid
            and sr.deleted_at is null
            and (
              (sr.resource_type = 'course' and sr.resource_id = ${courseId}::uuid)
              or (
                sr.resource_type = 'course_module'
                and sr.resource_id in (
                  select cm.id from course_modules cm
                  where cm.course_id = ${courseId}::uuid
                    and cm.tenant_id = sr.tenant_id
                    and cm.deleted_at is null
                )
              )
              or (
                sr.resource_type = 'lesson'
                and sr.resource_id in (
                  select l.id from lessons l
                  join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                  where cm.course_id = ${courseId}::uuid
                    and l.tenant_id = sr.tenant_id
                    and l.deleted_at is null
                    and cm.deleted_at is null
                )
              )
            )
        `;
        deletedAssetsGb += sizeRows[0]?.storage_gb ?? 0;
        await tx.$executeRaw`
          update storage_references sr
          set deleted_at = now()
          where sr.tenant_id = current_setting('app.tenant_id', true)::uuid
            and sr.deleted_at is null
            and (
              (sr.resource_type = 'course' and sr.resource_id = ${courseId}::uuid)
              or (
                sr.resource_type = 'course_module'
                and sr.resource_id in (
                  select cm.id from course_modules cm
                  where cm.course_id = ${courseId}::uuid
                    and cm.tenant_id = sr.tenant_id
                    and cm.deleted_at is null
                )
              )
              or (
                sr.resource_type = 'lesson'
                and sr.resource_id in (
                  select l.id from lessons l
                  join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                  where cm.course_id = ${courseId}::uuid
                    and l.tenant_id = sr.tenant_id
                    and l.deleted_at is null
                    and cm.deleted_at is null
                )
              )
            )
        `;
      }

      processedIds.push(courseId);
    }

    return {
      processedIds,
      skippedIds,
      deletedAssetsGb: roundGb(deletedAssetsGb),
    };
  },

  async countInactive(tx: TenantTx, query: ResourceUsageInactiveQuery): Promise<number> {
    const rows = await this.listInactiveFiltered(tx, query, { countOnly: true });
    return Number(rows[0]?.["count"] ?? 0);
  },

  async listInactive(
    tx: TenantTx,
    query: ResourceUsageInactiveQuery,
  ): Promise<ResourceUsageInactiveRow[]> {
    const rows = await this.listInactiveFiltered(tx, query, { countOnly: false });
    return rows.map((row) => ({
      membership_id: String(row["membership_id"]),
      learner_name: (row["learner_name"] as string | null) ?? null,
      email: (row["email"] as string | null) ?? null,
      status: String(row["status"]),
      activity_label: row["activity_label"] as "inactive" | "dormant" | "never_active",
      enrolment_count: Number(row["enrolment_count"]),
      last_active_at: (row["last_active_at"] as Date | null) ?? null,
      inactive_days: Number(row["inactive_days"]),
      created_at: row["created_at"] as Date,
      has_paid: Boolean(row["has_paid"]),
    }));
  },

  async listInactiveFiltered(
    tx: TenantTx,
    query: ResourceUsageInactiveQuery,
    opts: { countOnly: boolean },
  ): Promise<Array<Record<string, unknown>>> {
    const q = query.q ?? null;
    const inactiveDays = query.inactiveDays;
    const view = query.view;
    const activityStatus = query.activityStatus;
    const inactiveForMin = query.inactiveForMin ?? null;
    const enrolmentFilter = query.enrolmentFilter;
    const paidFilter = query.paidFilter;
    const includeInvited = query.includeInvitedNeverSignedIn;
    const excludePaid = query.excludeActivePaidEnrolment;
    const sort = query.sort;
    const offset = (query.page - 1) * query.limit;

    if (opts.countOnly) {
      return tx.$queryRaw<Array<Record<string, unknown>>>`
        with learner_base as (
          select
            m.id as membership_id,
            m.status::text as status,
            m.last_active_at,
            m.created_at,
            coalesce((
              select count(*)::int from enrollments e
              where e.tenant_id = m.tenant_id and e.membership_id = m.id
            ), 0) as enrolment_count,
            exists (
              select 1 from payment_orders po
              where po.tenant_id = m.tenant_id
                and po.membership_id = m.id
                and po.status = 'paid'
            ) or exists (
              select 1 from enrollments e
              where e.tenant_id = m.tenant_id
                and e.membership_id = m.id
                and e.enrolled_type = 'paid'
                and e.status = 'active'
            ) as has_paid,
            exists (
              select 1 from enrollments e
              where e.tenant_id = m.tenant_id
                and e.membership_id = m.id
                and e.enrolled_type = 'paid'
                and e.status = 'active'
            ) as has_active_paid_enrolment
          from memberships m
          join user_roles ur on ur.membership_id = m.id
          join roles r on r.id = ur.role_id and r.key = 'learner'
          left join member_profiles mp
            on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
          left join auth_principals ap on ap.id = m.auth_principal_id
          where m.tenant_id = current_setting('app.tenant_id', true)::uuid
            and (
              m.status = 'ACTIVE'
              or (
                ${includeInvited}::boolean
                and m.status = 'INVITED'
                and m.last_active_at is null
              )
            )
            and (m.last_active_at is null or m.last_active_at < now() - make_interval(days => ${inactiveDays}::int))
            and (
              ${q}::text is null
              or lower(coalesce(mp.display_name, '')) like '%' || lower(${q}) || '%'
              or lower(coalesce(ap.email, m.invited_email_normalized, '')) like '%' || lower(${q}) || '%'
            )
        ),
        inactive as (
          select
            *,
            greatest(
              0,
              floor(
                extract(
                  epoch from (
                    now() - coalesce(last_active_at, created_at, now())
                  )
                ) / 86400
              )
            )::int as inactive_days,
            case
              when last_active_at is null then 'never_active'
              when greatest(
                0,
                floor(
                  extract(
                    epoch from (now() - coalesce(last_active_at, created_at, now()))
                  ) / 86400
                )
              ) >= 365 then 'dormant'
              else 'inactive'
            end as activity_label
          from learner_base
          where (
            not ${excludePaid}::boolean
            or not has_active_paid_enrolment
          )
        )
        select count(*)::bigint as count
        from inactive
        where (
            ${view}::text = 'all'
            or (${view}::text = 'never_active' and activity_label = 'never_active')
            or (${view}::text = 'paid_holding' and has_paid)
          )
          and (
            ${activityStatus}::text = 'any'
            or (${activityStatus}::text = 'inactive' and activity_label = 'inactive')
            or (${activityStatus}::text = 'dormant' and activity_label = 'dormant')
            or (${activityStatus}::text = 'never_active' and activity_label = 'never_active')
          )
          and (${inactiveForMin}::int is null or inactive_days >= ${inactiveForMin}::int)
          and (
            ${enrolmentFilter}::text = 'any'
            or (${enrolmentFilter}::text = 'has_enrolments' and enrolment_count > 0)
            or (${enrolmentFilter}::text = 'zero_enrolments' and enrolment_count = 0)
          )
          and (
            ${paidFilter}::text = 'any'
            or (${paidFilter}::text = 'has_paid' and has_paid)
            or (${paidFilter}::text = 'never_paid' and not has_paid)
          )
      `;
    }

    return tx.$queryRaw<Array<Record<string, unknown>>>`
      with learner_base as (
        select
          m.id as membership_id,
          m.status::text as status,
          m.last_active_at,
          m.created_at,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          coalesce((
            select count(*)::int from enrollments e
            where e.tenant_id = m.tenant_id and e.membership_id = m.id
          ), 0) as enrolment_count,
          exists (
            select 1 from payment_orders po
            where po.tenant_id = m.tenant_id
              and po.membership_id = m.id
              and po.status = 'paid'
          ) or exists (
            select 1 from enrollments e
            where e.tenant_id = m.tenant_id
              and e.membership_id = m.id
              and e.enrolled_type = 'paid'
              and e.status = 'active'
          ) as has_paid,
          exists (
            select 1 from enrollments e
            where e.tenant_id = m.tenant_id
              and e.membership_id = m.id
              and e.enrolled_type = 'paid'
              and e.status = 'active'
          ) as has_active_paid_enrolment
        from memberships m
        join user_roles ur on ur.membership_id = m.id
        join roles r on r.id = ur.role_id and r.key = 'learner'
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            m.status = 'ACTIVE'
            or (
              ${includeInvited}::boolean
              and m.status = 'INVITED'
              and m.last_active_at is null
            )
          )
          and (m.last_active_at is null or m.last_active_at < now() - make_interval(days => ${inactiveDays}::int))
          and (
            ${q}::text is null
            or lower(coalesce(mp.display_name, '')) like '%' || lower(${q}) || '%'
            or lower(coalesce(ap.email, m.invited_email_normalized, '')) like '%' || lower(${q}) || '%'
          )
      ),
      inactive as (
        select
          *,
          greatest(
            0,
            floor(
              extract(
                epoch from (
                  now() - coalesce(last_active_at, created_at, now())
                )
              ) / 86400
            )
          )::int as inactive_days,
          case
            when last_active_at is null then 'never_active'
            when greatest(
              0,
              floor(
                extract(
                  epoch from (now() - coalesce(last_active_at, created_at, now()))
                ) / 86400
              )
            ) >= 365 then 'dormant'
            else 'inactive'
          end as activity_label
        from learner_base
        where (
          not ${excludePaid}::boolean
          or not has_active_paid_enrolment
        )
      )
      select
        membership_id::text as membership_id,
        learner_name,
        email,
        status,
        activity_label,
        enrolment_count,
        last_active_at,
        inactive_days,
        created_at,
        has_paid
      from inactive
      where (
          ${view}::text = 'all'
          or (${view}::text = 'never_active' and activity_label = 'never_active')
          or (${view}::text = 'paid_holding' and has_paid)
        )
        and (
          ${activityStatus}::text = 'any'
          or (${activityStatus}::text = 'inactive' and activity_label = 'inactive')
          or (${activityStatus}::text = 'dormant' and activity_label = 'dormant')
          or (${activityStatus}::text = 'never_active' and activity_label = 'never_active')
        )
        and (${inactiveForMin}::int is null or inactive_days >= ${inactiveForMin}::int)
        and (
          ${enrolmentFilter}::text = 'any'
          or (${enrolmentFilter}::text = 'has_enrolments' and enrolment_count > 0)
          or (${enrolmentFilter}::text = 'zero_enrolments' and enrolment_count = 0)
        )
        and (
          ${paidFilter}::text = 'any'
          or (${paidFilter}::text = 'has_paid' and has_paid)
          or (${paidFilter}::text = 'never_paid' and not has_paid)
        )
      order by
        case when ${sort}::text = 'inactive_desc' then inactive_days end desc nulls last,
        case when ${sort}::text = 'inactive_asc' then inactive_days end asc nulls last,
        case when ${sort}::text = 'activity_asc' then last_active_at end asc nulls first,
        case when ${sort}::text = 'name_asc' then learner_name end asc nulls last,
        case when ${sort}::text = 'enrolments_desc' then enrolment_count end desc nulls last,
        case when ${sort}::text = 'signed_up_asc' then created_at end asc nulls last,
        inactive_days desc,
        learner_name asc
      limit ${query.limit} offset ${offset}
    `;
  },

  async getInactiveSummary(
    tx: TenantTx,
    query: ResourceUsageInactiveQuery,
  ): Promise<ResourceUsageInactiveSummaryRow> {
    const inactiveDays = query.inactiveDays;
    const includeInvited = query.includeInvitedNeverSignedIn;
    const excludePaid = query.excludeActivePaidEnrolment;

    const rows = await tx.$queryRaw<Array<ResourceUsageInactiveSummaryRow>>`
      with learner_base as (
        select
          m.id as membership_id,
          m.last_active_at,
          m.created_at,
          coalesce((
            select count(*)::int from enrollments e
            where e.tenant_id = m.tenant_id and e.membership_id = m.id
          ), 0) as enrolment_count,
          exists (
            select 1 from payment_orders po
            where po.tenant_id = m.tenant_id
              and po.membership_id = m.id
              and po.status = 'paid'
          ) or exists (
            select 1 from enrollments e
            where e.tenant_id = m.tenant_id
              and e.membership_id = m.id
              and e.enrolled_type = 'paid'
              and e.status = 'active'
          ) as has_paid,
          exists (
            select 1 from enrollments e
            where e.tenant_id = m.tenant_id
              and e.membership_id = m.id
              and e.enrolled_type = 'paid'
              and e.status = 'active'
          ) as has_active_paid_enrolment
        from memberships m
        join user_roles ur on ur.membership_id = m.id
        join roles r on r.id = ur.role_id and r.key = 'learner'
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            m.status = 'ACTIVE'
            or (
              ${includeInvited}::boolean
              and m.status = 'INVITED'
              and m.last_active_at is null
            )
          )
      ),
      inactive as (
        select
          *,
          greatest(
            0,
            floor(
              extract(
                epoch from (now() - coalesce(last_active_at, created_at, now()))
              ) / 86400
            )
          )::int as inactive_days
        from learner_base
        where (last_active_at is null or last_active_at < now() - make_interval(days => ${inactiveDays}::int))
          and (
            not ${excludePaid}::boolean
            or not has_active_paid_enrolment
          )
      )
      select
        (select count(*)::int from inactive) as inactive_learner_count,
        (
          select count(distinct m.id)::int
          from memberships m
          join user_roles ur on ur.membership_id = m.id
          join roles r on r.id = ur.role_id and r.key = 'learner'
          where m.tenant_id = current_setting('app.tenant_id', true)::uuid
            and m.status in ('ACTIVE', 'INVITED')
        ) as total_learner_count,
        (select count(*)::int from inactive where last_active_at is null) as never_active_count,
        (select count(*)::int from inactive where inactive_days >= 365) as inactive_over_year_count,
        (select coalesce(sum(enrolment_count), 0)::int from inactive) as enrolments_held,
        (select count(*)::int from inactive where has_paid) as paid_among_them,
        (select count(*)::int from inactive) as view_all,
        (select count(*)::int from inactive where last_active_at is null) as view_never_active,
        (select count(*)::int from inactive where has_paid) as view_paid_holding
    `;

    return (
      rows[0] ?? {
        inactive_learner_count: 0,
        total_learner_count: 0,
        never_active_count: 0,
        inactive_over_year_count: 0,
        enrolments_held: 0,
        paid_among_them: 0,
        view_all: 0,
        view_never_active: 0,
        view_paid_holding: 0,
      }
    );
  },

  async deactivateInactiveLearners(
    tx: TenantTx,
    args: {
      membershipIds: string[];
      excludePaid: boolean;
    },
  ): Promise<{
    processedIds: string[];
    skippedIds: string[];
    excludedPaidIds: string[];
  }> {
    const processedIds: string[] = [];
    const skippedIds: string[] = [];
    const excludedPaidIds: string[] = [];

    for (const membershipId of args.membershipIds) {
      if (args.excludePaid) {
        const paidRows = await tx.$queryRaw<Array<{ has_paid: boolean }>>`
          select exists (
            select 1 from enrollments e
            where e.tenant_id = current_setting('app.tenant_id', true)::uuid
              and e.membership_id = ${membershipId}::uuid
              and e.enrolled_type = 'paid'
              and e.status = 'active'
          ) or exists (
            select 1 from payment_orders po
            where po.tenant_id = current_setting('app.tenant_id', true)::uuid
              and po.membership_id = ${membershipId}::uuid
              and po.status = 'paid'
          ) as has_paid
        `;
        if (paidRows[0]?.has_paid) {
          excludedPaidIds.push(membershipId);
          continue;
        }
      }

      const updated = await tx.$queryRaw<Array<{ id: string }>>`
        update memberships
        set
          status = 'SUSPENDED',
          suspended_at = now(),
          updated_at = now()
        where tenant_id = current_setting('app.tenant_id', true)::uuid
          and id = ${membershipId}::uuid
          and status in ('ACTIVE', 'INVITED')
        returning id::text
      `;

      if (updated[0]) {
        processedIds.push(membershipId);
      } else {
        skippedIds.push(membershipId);
      }
    }

    return { processedIds, skippedIds, excludedPaidIds };
  },

  async listRecentlyMessagedMembershipIds(
    tx: TenantTx,
    membershipIds: string[],
    withinDays: number,
  ): Promise<string[]> {
    if (membershipIds.length === 0 || withinDays <= 0) return [];
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select distinct nd.membership_id::text as membership_id
      from notification_dispatches nd
      where nd.tenant_id = current_setting('app.tenant_id', true)::uuid
        and nd.membership_id = any(${membershipIds}::uuid[])
        and nd.template_key like 'reports.resource-usage.inactive%'
        and nd.created_at >= now() - make_interval(days => ${withinDays}::int)
    `;
    return rows.map((row) => row.membership_id);
  },

  async listMetricPeriods(
    tx: TenantTx,
    metricKey: string,
    rangeMonths = 24,
  ): Promise<
    Array<{
      period: string;
      value: number;
      previous_value: number | null;
      change_absolute: number | null;
      calculated_at: Date | null;
    }>
  > {
    const lookbackMonths = Math.max(0, rangeMonths - 1);
    const rows = await tx.$queryRaw<
      Array<{
        period: string;
        value: number;
        previous_value: number | null;
        calculated_at: Date | null;
      }>
    >`
      with base as (
        select
          to_char(date_trunc('month', ar.period_start), 'YYYY-MM-DD') as period,
          ar.period_start,
          ar.calculated_at,
          case
            when ar.rollup_key in ('usage.message_sends', 'usage.email_validations')
              then coalesce((ar.metrics_json->>'count')::float8, 0)
            else coalesce((ar.metrics_json->>'value')::float8, 0)
          end as value
        from analytics_rollups ar
        where ar.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ar.rollup_key = ${metricKey}
          and ar.period_start >= date_trunc('month', now()) - make_interval(months => ${lookbackMonths})
      )
      select
        period,
        value,
        lag(value) over (order by period_start) as previous_value,
        calculated_at
      from base
      order by period_start desc
    `;

    return rows.map((row) => {
      const previous = row.previous_value;
      const changeAbsolute =
        previous == null ? null : Math.round((row.value - previous) * 100) / 100;
      return {
        period: row.period,
        value: row.value,
        previous_value: previous == null ? null : previous,
        change_absolute: changeAbsolute,
        calculated_at: row.calculated_at,
      };
    });
  },

  async getStorageAssetBreakdown(
    tx: TenantTx,
  ): Promise<Array<{ key: string; label: string; storage_gb: number }>> {
    const rows = await tx.$queryRaw<Array<{ asset_key: string; storage_gb: number }>>`
      select
        case
          when lower(coalesce(purpose, '')) like '%backup%' then 'backups'
          when lower(coalesce(purpose, '')) like '%scorm%'
            or lower(coalesce(content_type, '')) like '%scorm%' then 'scorm'
          when content_type like 'video/%' then 'video'
          when content_type like 'audio/%' then 'audio'
          when content_type like 'image/%' then 'images'
          when content_type like 'application/pdf%'
            or content_type like 'text/%'
            or content_type like 'application/msword%'
            or content_type like 'application/vnd.openxmlformats%'
            or content_type like 'application/vnd.ms-%' then 'documents'
          else 'attachments'
        end as asset_key,
        coalesce(sum(size_bytes), 0)::float8 / 1e9 as storage_gb
      from storage_references
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and deleted_at is null
      group by 1
      having coalesce(sum(size_bytes), 0) > 0
      order by storage_gb desc
    `;

    const labels: Record<string, string> = {
      video: "Video",
      documents: "Documents",
      images: "Images",
      audio: "Audio",
      scorm: "SCORM",
      attachments: "Attachments",
      backups: "Backups",
    };

    return rows.map((row) => ({
      key: row.asset_key,
      label: labels[row.asset_key] ?? row.asset_key,
      storage_gb: roundGb(row.storage_gb),
    }));
  },

  async listTopStorageContributors(
    tx: TenantTx,
    limit = 10,
  ): Promise<
    Array<{
      course_id: string;
      title: string;
      storage_gb: number;
      updated_at: Date | null;
    }>
  > {
    const rows = await tx.$queryRaw<
      Array<{
        course_id: string;
        title: string;
        storage_gb: number;
        updated_at: Date | null;
      }>
    >`
      select
        c.id::text as course_id,
        c.title,
        c.updated_at,
        coalesce((
          select sum(sr.size_bytes)::float8 / 1e9
          from storage_references sr
          where sr.deleted_at is null
            and sr.tenant_id = c.tenant_id
            and (
              (sr.resource_type = 'course' and sr.resource_id = c.id)
              or (
                sr.resource_type = 'course_module'
                and sr.resource_id in (
                  select cm2.id from course_modules cm2
                  where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                )
              )
              or (
                sr.resource_type = 'lesson'
                and sr.resource_id in (
                  select l2.id from lessons l2
                  join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                  where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                    and l2.deleted_at is null and cm3.deleted_at is null
                )
              )
            )
        ), 0) as storage_gb
      from courses c
      where c.tenant_id = current_setting('app.tenant_id', true)::uuid
        and c.deleted_at is null
      order by storage_gb desc, c.title asc
      limit ${limit}
    `;

    return rows
      .filter((row) => row.storage_gb > 0)
      .map((row) => ({
        course_id: row.course_id,
        title: row.title,
        storage_gb: roundGb(row.storage_gb),
        updated_at: row.updated_at,
      }));
  },

  async getStorageFileCount(tx: TenantTx): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from storage_references
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and deleted_at is null
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async getStorageReclaimSignals(tx: TenantTx): Promise<{
    orphaned_gb: number;
    archived_gb: number;
  }> {
    const [orphanRows, archivedRows] = await Promise.all([
      tx.$queryRaw<Array<{ storage_gb: number }>>`
        select coalesce(sum(size_bytes), 0)::float8 / 1e9 as storage_gb
        from storage_references
        where tenant_id = current_setting('app.tenant_id', true)::uuid
          and deleted_at is null
          and resource_id is null
      `,
      tx.$queryRaw<Array<{ storage_gb: number }>>`
        select coalesce(sum(sr.size_bytes), 0)::float8 / 1e9 as storage_gb
        from storage_references sr
        join courses c
          on c.id = sr.resource_id
          and c.tenant_id = sr.tenant_id
          and c.deleted_at is null
        where sr.tenant_id = current_setting('app.tenant_id', true)::uuid
          and sr.deleted_at is null
          and sr.resource_type = 'course'
          and c.status = 'ARCHIVED'
      `,
    ]);
    return {
      orphaned_gb: roundGb(orphanRows[0]?.storage_gb ?? 0),
      archived_gb: roundGb(archivedRows[0]?.storage_gb ?? 0),
    };
  },

  async countStorageHolders(tx: TenantTx, assetType: string | null): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with course_storage as (
        select
          c.id,
          coalesce((
            select sum(sr.size_bytes)::float8 / 1e9
            from storage_references sr
            where sr.deleted_at is null
              and sr.tenant_id = c.tenant_id
              and (
                ${assetType}::text is null
                or (
                  case
                    when lower(coalesce(sr.purpose, '')) like '%backup%' then 'backups'
                    when lower(coalesce(sr.purpose, '')) like '%scorm%'
                      or lower(coalesce(sr.content_type, '')) like '%scorm%' then 'scorm'
                    when sr.content_type like 'video/%' then 'video'
                    when sr.content_type like 'audio/%' then 'audio'
                    when sr.content_type like 'image/%' then 'images'
                    when sr.content_type like 'application/pdf%'
                      or sr.content_type like 'text/%'
                      or sr.content_type like 'application/msword%'
                      or sr.content_type like 'application/vnd.openxmlformats%'
                      or sr.content_type like 'application/vnd.ms-%' then 'documents'
                    else 'attachments'
                  end
                ) = ${assetType}
              )
              and (
                (sr.resource_type = 'course' and sr.resource_id = c.id)
                or (
                  sr.resource_type = 'course_module'
                  and sr.resource_id in (
                    select cm2.id from course_modules cm2
                    where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                  )
                )
                or (
                  sr.resource_type = 'lesson'
                  and sr.resource_id in (
                    select l2.id from lessons l2
                    join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                    where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                      and l2.deleted_at is null and cm3.deleted_at is null
                  )
                )
              )
          ), 0) as storage_gb
        from courses c
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
      )
      select count(*)::bigint as count
      from course_storage
      where storage_gb > 0
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listStorageHolders(
    tx: TenantTx,
    args: {
      assetType: string | null;
      sort: "size_desc" | "files_desc" | "activity_asc" | "title_asc";
      page: number;
      limit: number;
    },
  ): Promise<
    Array<{
      course_id: string;
      title: string;
      status: string;
      storage_gb: number;
      file_count: number;
      last_learner_activity_at: Date | null;
      created_at: Date | null;
    }>
  > {
    const offset = (args.page - 1) * args.limit;
    const assetType = args.assetType;
    const sort = args.sort;
    const rows = await tx.$queryRaw<
      Array<{
        course_id: string;
        title: string;
        status: string;
        storage_gb: number;
        file_count: number;
        last_learner_activity_at: Date | null;
        created_at: Date | null;
      }>
    >`
      with course_storage as (
        select
          c.id as course_id,
          c.title,
          c.status::text as status,
          c.created_at,
          max(lp.last_seen_at) as last_learner_activity_at,
          coalesce((
            select sum(sr.size_bytes)::float8 / 1e9
            from storage_references sr
            where sr.deleted_at is null
              and sr.tenant_id = c.tenant_id
              and (
                ${assetType}::text is null
                or (
                  case
                    when lower(coalesce(sr.purpose, '')) like '%backup%' then 'backups'
                    when lower(coalesce(sr.purpose, '')) like '%scorm%'
                      or lower(coalesce(sr.content_type, '')) like '%scorm%' then 'scorm'
                    when sr.content_type like 'video/%' then 'video'
                    when sr.content_type like 'audio/%' then 'audio'
                    when sr.content_type like 'image/%' then 'images'
                    when sr.content_type like 'application/pdf%'
                      or sr.content_type like 'text/%'
                      or sr.content_type like 'application/msword%'
                      or sr.content_type like 'application/vnd.openxmlformats%'
                      or sr.content_type like 'application/vnd.ms-%' then 'documents'
                    else 'attachments'
                  end
                ) = ${assetType}
              )
              and (
                (sr.resource_type = 'course' and sr.resource_id = c.id)
                or (
                  sr.resource_type = 'course_module'
                  and sr.resource_id in (
                    select cm2.id from course_modules cm2
                    where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                  )
                )
                or (
                  sr.resource_type = 'lesson'
                  and sr.resource_id in (
                    select l2.id from lessons l2
                    join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                    where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                      and l2.deleted_at is null and cm3.deleted_at is null
                  )
                )
              )
          ), 0) as storage_gb,
          coalesce((
            select count(*)::int
            from storage_references sr
            where sr.deleted_at is null
              and sr.tenant_id = c.tenant_id
              and (
                (sr.resource_type = 'course' and sr.resource_id = c.id)
                or (
                  sr.resource_type = 'course_module'
                  and sr.resource_id in (
                    select cm2.id from course_modules cm2
                    where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                  )
                )
                or (
                  sr.resource_type = 'lesson'
                  and sr.resource_id in (
                    select l2.id from lessons l2
                    join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                    where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                      and l2.deleted_at is null and cm3.deleted_at is null
                  )
                )
              )
          ), 0) as file_count
        from courses c
        left join course_modules cm
          on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
        left join lessons l
          on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
        left join lesson_progress lp
          on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
        group by c.id, c.title, c.status, c.created_at
      )
      select
        course_id::text as course_id,
        title,
        status,
        storage_gb,
        file_count,
        last_learner_activity_at,
        created_at
      from course_storage
      where storage_gb > 0
      order by
        case when ${sort}::text = 'size_desc' then storage_gb end desc nulls last,
        case when ${sort}::text = 'files_desc' then file_count end desc nulls last,
        case when ${sort}::text = 'activity_asc' then last_learner_activity_at end asc nulls first,
        case when ${sort}::text = 'title_asc' then title end asc nulls last,
        title asc
      limit ${args.limit} offset ${offset}
    `;

    return rows.map((row) => ({
      course_id: row.course_id,
      title: row.title,
      status: row.status,
      storage_gb: roundGb(row.storage_gb),
      file_count: row.file_count,
      last_learner_activity_at: row.last_learner_activity_at,
      created_at: row.created_at,
    }));
  },

  async getDormantCourseDetail(
    tx: TenantTx,
    courseId: string,
    _dormantDays: number,
  ): Promise<{
    course: {
      course_id: string;
      title: string;
      status: string;
      created_at: Date | null;
      dormant_days: number;
      never_opened: boolean;
      last_learner_activity_at: Date | null;
    } | null;
    summary: {
      storage_gb: number;
      total_tenant_storage_gb: number;
      lesson_count: number;
      lessons_with_assets_count: number;
      file_count: number;
      enrolment_total: number;
      enrolment_active: number;
      enrolment_active_in_90d: number;
    };
    composition: Array<{ key: string; label: string; storage_gb: number }>;
    top_files: Array<{
      file_name: string;
      content_type: string | null;
      asset_type_key: string;
      size_bytes: number;
      lesson_id: string | null;
      lesson_title: string | null;
      uploaded_at: Date | null;
    }>;
    certificates_remain_valid: number;
    lessons: Array<{
      lesson_id: string;
      position: number;
      title: string;
      video_provider: string | null;
      video_url: string | null;
      duration_seconds: number | null;
      storage_gb: number;
      last_opened_at: Date | null;
      has_scorm: boolean;
    }>;
  }> {
    void _dormantDays;
    const courseRows = await tx.$queryRaw<
      Array<{
        course_id: string;
        title: string;
        status: string;
        created_at: Date | null;
        dormant_days: number;
        never_opened: boolean;
        last_learner_activity_at: Date | null;
        storage_gb: number;
        lesson_count: number;
        lessons_with_assets_count: number;
        file_count: number;
        enrolment_total: number;
        enrolment_active: number;
        enrolment_active_in_90d: number;
      }>
    >`
      with course_scope as (
        select
          c.id as course_id,
          c.title,
          c.status::text as status,
          c.created_at,
          c.tenant_id,
          (
            select max(lp.last_seen_at)
            from lesson_progress lp
            join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
            join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
            where cm.course_id = c.id
              and lp.tenant_id = c.tenant_id
          ) as last_learner_activity_at
        from courses c
        where c.id = ${courseId}::uuid
          and c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
      ),
      course_lessons as (
        select l.id as lesson_id
        from course_scope cs
        join course_modules cm
          on cm.course_id = cs.course_id
          and cm.tenant_id = cs.tenant_id
          and cm.deleted_at is null
        join lessons l
          on l.module_id = cm.id
          and l.tenant_id = cs.tenant_id
          and l.deleted_at is null
      ),
      course_modules_scope as (
        select cm.id as module_id
        from course_scope cs
        join course_modules cm
          on cm.course_id = cs.course_id
          and cm.tenant_id = cs.tenant_id
          and cm.deleted_at is null
      ),
      storage_scope as (
        select sr.*
        from course_scope cs
        join storage_references sr
          on sr.tenant_id = cs.tenant_id
          and sr.deleted_at is null
          and (
            (sr.resource_type = 'course' and sr.resource_id = cs.course_id)
            or (
              sr.resource_type = 'course_module'
              and sr.resource_id in (select module_id from course_modules_scope)
            )
            or (
              sr.resource_type = 'lesson'
              and sr.resource_id in (select lesson_id from course_lessons)
            )
          )
      )
      select
        cs.course_id::text as course_id,
        cs.title,
        cs.status,
        cs.created_at,
        cs.last_learner_activity_at,
        (cs.last_learner_activity_at is null) as never_opened,
        greatest(
          0,
          floor(
            extract(
              epoch from (
                now() - coalesce(cs.last_learner_activity_at, cs.created_at, now())
              )
            ) / 86400
          )
        )::int as dormant_days,
        coalesce((select sum(size_bytes)::float8 / 1e9 from storage_scope), 0) as storage_gb,
        coalesce((select count(*)::int from course_lessons), 0) as lesson_count,
        coalesce((
          select count(distinct sr.resource_id)::int
          from storage_scope sr
          where sr.resource_type = 'lesson'
            and sr.resource_id is not null
        ), 0) as lessons_with_assets_count,
        coalesce((select count(*)::int from storage_scope), 0) as file_count,
        coalesce((
          select count(*)::int from enrollments e
          where e.tenant_id = cs.tenant_id and e.course_id = cs.course_id
        ), 0) as enrolment_total,
        coalesce((
          select count(*)::int from enrollments e
          where e.tenant_id = cs.tenant_id and e.course_id = cs.course_id and e.status = 'active'
        ), 0) as enrolment_active,
        coalesce((
          select count(distinct e.membership_id)::int
          from enrollments e
          where e.tenant_id = cs.tenant_id
            and e.course_id = cs.course_id
            and exists (
              select 1
              from lesson_progress lp
              join course_lessons cl on cl.lesson_id = lp.lesson_id
              where lp.membership_id = e.membership_id
                and lp.tenant_id = e.tenant_id
                and lp.last_seen_at >= now() - interval '90 days'
            )
        ), 0) as enrolment_active_in_90d
      from course_scope cs
    `;

    const courseRow = courseRows[0];
    if (!courseRow) {
      return {
        course: null,
        summary: {
          storage_gb: 0,
          total_tenant_storage_gb: 0,
          lesson_count: 0,
          lessons_with_assets_count: 0,
          file_count: 0,
          enrolment_total: 0,
          enrolment_active: 0,
          enrolment_active_in_90d: 0,
        },
        composition: [],
        top_files: [],
        certificates_remain_valid: 0,
        lessons: [],
      };
    }

    const assetLabels: Record<string, string> = {
      video: "Video",
      documents: "Documents",
      images: "Images",
      audio: "Audio",
      scorm: "SCORM",
      attachments: "Attachments",
      backups: "Backups",
    };

    const [tenantStorageRows, compositionRows, topFileRows, certificateRows, lessonRows] =
      await Promise.all([
        tx.$queryRaw<Array<{ storage_gb: number }>>`
        select coalesce(sum(size_bytes), 0)::float8 / 1e9 as storage_gb
        from storage_references
        where tenant_id = current_setting('app.tenant_id', true)::uuid
          and deleted_at is null
      `,
        tx.$queryRaw<Array<{ asset_key: string; storage_gb: number }>>`
        with course_lessons as (
          select l.id as lesson_id
          from course_modules cm
          join lessons l
            on l.module_id = cm.id
            and l.tenant_id = cm.tenant_id
            and l.deleted_at is null
          where cm.course_id = ${courseId}::uuid
            and cm.tenant_id = current_setting('app.tenant_id', true)::uuid
            and cm.deleted_at is null
        ),
        course_modules_scope as (
          select cm.id as module_id
          from course_modules cm
          where cm.course_id = ${courseId}::uuid
            and cm.tenant_id = current_setting('app.tenant_id', true)::uuid
            and cm.deleted_at is null
        )
        select
          case
            when lower(coalesce(sr.purpose, '')) like '%backup%' then 'backups'
            when lower(coalesce(sr.purpose, '')) like '%scorm%'
              or lower(coalesce(sr.content_type, '')) like '%scorm%' then 'scorm'
            when sr.content_type like 'video/%' then 'video'
            when sr.content_type like 'audio/%' then 'audio'
            when sr.content_type like 'image/%' then 'images'
            when sr.content_type like 'application/pdf%'
              or sr.content_type like 'text/%'
              or sr.content_type like 'application/msword%'
              or sr.content_type like 'application/vnd.openxmlformats%'
              or sr.content_type like 'application/vnd.ms-%' then 'documents'
            else 'attachments'
          end as asset_key,
          coalesce(sum(sr.size_bytes), 0)::float8 / 1e9 as storage_gb
        from storage_references sr
        where sr.tenant_id = current_setting('app.tenant_id', true)::uuid
          and sr.deleted_at is null
          and (
            (sr.resource_type = 'course' and sr.resource_id = ${courseId}::uuid)
            or (
              sr.resource_type = 'course_module'
              and sr.resource_id in (select module_id from course_modules_scope)
            )
            or (
              sr.resource_type = 'lesson'
              and sr.resource_id in (select lesson_id from course_lessons)
            )
          )
        group by 1
        having coalesce(sum(sr.size_bytes), 0) > 0
        order by storage_gb desc
      `,
        tx.$queryRaw<
          Array<{
            file_name: string;
            content_type: string | null;
            asset_type_key: string;
            size_bytes: number;
            lesson_id: string | null;
            lesson_title: string | null;
            uploaded_at: Date | null;
          }>
        >`
        with course_lessons as (
          select l.id as lesson_id, l.title as lesson_title
          from course_modules cm
          join lessons l
            on l.module_id = cm.id
            and l.tenant_id = cm.tenant_id
            and l.deleted_at is null
          where cm.course_id = ${courseId}::uuid
            and cm.tenant_id = current_setting('app.tenant_id', true)::uuid
            and cm.deleted_at is null
        ),
        course_modules_scope as (
          select cm.id as module_id
          from course_modules cm
          where cm.course_id = ${courseId}::uuid
            and cm.tenant_id = current_setting('app.tenant_id', true)::uuid
            and cm.deleted_at is null
        )
        select
          sr.file_name,
          sr.content_type,
          case
            when lower(coalesce(sr.purpose, '')) like '%backup%' then 'backups'
            when lower(coalesce(sr.purpose, '')) like '%scorm%'
              or lower(coalesce(sr.content_type, '')) like '%scorm%' then 'scorm'
            when sr.content_type like 'video/%' then 'video'
            when sr.content_type like 'audio/%' then 'audio'
            when sr.content_type like 'image/%' then 'images'
            when sr.content_type like 'application/pdf%'
              or sr.content_type like 'text/%'
              or sr.content_type like 'application/msword%'
              or sr.content_type like 'application/vnd.openxmlformats%'
              or sr.content_type like 'application/vnd.ms-%' then 'documents'
            when lower(sr.file_name) like '%.zip' then 'attachments'
            else 'attachments'
          end as asset_type_key,
          sr.size_bytes::float8 as size_bytes,
          case when sr.resource_type = 'lesson' then sr.resource_id::text else null end as lesson_id,
          case when sr.resource_type = 'lesson' then cl.lesson_title else null end as lesson_title,
          sr.created_at as uploaded_at
        from storage_references sr
        left join course_lessons cl on cl.lesson_id = sr.resource_id and sr.resource_type = 'lesson'
        where sr.tenant_id = current_setting('app.tenant_id', true)::uuid
          and sr.deleted_at is null
          and (
            (sr.resource_type = 'course' and sr.resource_id = ${courseId}::uuid)
            or (
              sr.resource_type = 'course_module'
              and sr.resource_id in (select module_id from course_modules_scope)
            )
            or (
              sr.resource_type = 'lesson'
              and sr.resource_id in (select lesson_id from course_lessons)
            )
          )
        order by sr.size_bytes desc nulls last
        limit 10
      `,
        tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from certificates c
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.status = 'issued'
          and c.revoked_at is null
          and c.metadata_json->'source'->>'type' = 'course'
          and c.metadata_json->'source'->>'id' = ${courseId}
      `,
        tx.$queryRaw<
          Array<{
            lesson_id: string;
            position: number;
            title: string;
            video_provider: string | null;
            video_url: string | null;
            duration_seconds: number | null;
            storage_gb: number;
            last_opened_at: Date | null;
            has_scorm: boolean;
          }>
        >`
        select
          l.id::text as lesson_id,
          l.position,
          l.title,
          l.video_provider,
          l.video_url,
          l.duration_seconds,
          coalesce((
            select sum(sr.size_bytes)::float8 / 1e9
            from storage_references sr
            where sr.tenant_id = l.tenant_id
              and sr.deleted_at is null
              and sr.resource_type = 'lesson'
              and sr.resource_id = l.id
          ), 0) as storage_gb,
          (
            select max(lp.last_seen_at)
            from lesson_progress lp
            where lp.lesson_id = l.id
              and lp.tenant_id = l.tenant_id
          ) as last_opened_at,
          exists (
            select 1
            from storage_references sr
            where sr.tenant_id = l.tenant_id
              and sr.deleted_at is null
              and sr.resource_type = 'lesson'
              and sr.resource_id = l.id
              and (
                lower(coalesce(sr.purpose, '')) like '%scorm%'
                or lower(coalesce(sr.content_type, '')) like '%scorm%'
              )
          ) as has_scorm
        from lessons l
        join course_modules cm
          on cm.id = l.module_id
          and cm.tenant_id = l.tenant_id
          and cm.deleted_at is null
        where cm.course_id = ${courseId}::uuid
          and l.tenant_id = current_setting('app.tenant_id', true)::uuid
          and l.deleted_at is null
        order by cm.position asc nulls last, l.position asc nulls last, l.title asc
      `,
      ]);

    return {
      course: {
        course_id: courseRow.course_id,
        title: courseRow.title,
        status: courseRow.status,
        created_at: courseRow.created_at,
        dormant_days: courseRow.dormant_days,
        never_opened: courseRow.never_opened,
        last_learner_activity_at: courseRow.last_learner_activity_at,
      },
      summary: {
        storage_gb: roundGb(courseRow.storage_gb),
        total_tenant_storage_gb: roundGb(tenantStorageRows[0]?.storage_gb ?? 0),
        lesson_count: courseRow.lesson_count,
        lessons_with_assets_count: courseRow.lessons_with_assets_count,
        file_count: courseRow.file_count,
        enrolment_total: courseRow.enrolment_total,
        enrolment_active: courseRow.enrolment_active,
        enrolment_active_in_90d: courseRow.enrolment_active_in_90d,
      },
      composition: compositionRows.map((row) => ({
        key: row.asset_key,
        label: assetLabels[row.asset_key] ?? row.asset_key,
        storage_gb: roundGb(row.storage_gb),
      })),
      top_files: topFileRows.map((row) => ({
        file_name: row.file_name,
        content_type: row.content_type,
        asset_type_key: row.asset_type_key,
        size_bytes: row.size_bytes,
        lesson_id: row.lesson_id,
        lesson_title: row.lesson_title,
        uploaded_at: row.uploaded_at,
      })),
      certificates_remain_valid: Number(certificateRows[0]?.count ?? 0),
      lessons: lessonRows.map((row) => ({
        lesson_id: row.lesson_id,
        position: row.position,
        title: row.title,
        video_provider: row.video_provider,
        video_url: row.video_url,
        duration_seconds: row.duration_seconds == null ? null : row.duration_seconds,
        storage_gb: roundGb(row.storage_gb),
        last_opened_at: row.last_opened_at,
        has_scorm: row.has_scorm,
      })),
    };
  },
};

export { METRIC_LABELS, METRIC_UNITS, USAGE_HISTORY_KEYS };
