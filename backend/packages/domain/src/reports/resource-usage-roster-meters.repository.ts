import type { TenantTx } from "@atlas/db";
import type { ResourceUsageHistoryQuery } from "./resource-usage-roster.dto";
import type {
  ResourceUsageHistoryRow,
  ResourceUsageHistorySeriesRow,
  ResourceUsageHistorySummary,
  ResourceUsageLimits,
  ResourceUsageMeters,
  ResourceUsageOptimizationCounts,
  ResourceUsageStorageTrend,
} from "./resource-usage-roster.repository";
import {
  METRIC_LABELS,
  METRIC_UNITS,
  roundGb,
  USAGE_HISTORY_KEYS,
} from "./resource-usage-roster.repository-helpers";

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

/**
 * Usage meters, limits and metric history.
 * Part of resourceUsageRosterRepository.
 */
export const resourceUsageRosterMetersRepository = {
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
};
