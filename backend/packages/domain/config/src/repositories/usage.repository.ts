import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

/**
 * Tier-A usage metrics that can be derived live from existing tenant tables,
 * with no dedicated metering pipeline. All queries rely on row-level security
 * for tenant scoping (the tenant transaction sets the tenant context), mirroring
 * the entitlement/subscription repositories.
 */
export type UsageTierAMetrics = {
  currentMau: number;
  totalLearners: number;
  storageGb: number;
  products: number;
  questions: number;
  testSubmits: number;
};

type UsageMetricsRow = {
  current_mau: number;
  total_learners: number;
  storage_gb: number;
  products: number;
  questions: number;
  test_submits: number;
};

/** Rollup keys used for monthly gauge snapshots in analytics_rollups. */
export const USAGE_SNAPSHOT_KEYS = {
  storageGb: "usage.storage_gb",
  totalLearners: "usage.total_learners",
  products: "usage.products",
  questions: "usage.questions",
  testSubmits: "usage.test_submits",
} as const;

/** Rollup keys for event-driven monthly usage counters (Tier B). */
export const USAGE_COUNTER_KEYS = {
  messageSends: "usage.message_sends",
  emailValidations: "usage.email_validations",
} as const;

export async function getUsageTierAMetrics(tx: TenantTx): Promise<UsageTierAMetrics> {
  const rows = await tx.$queryRaw<UsageMetricsRow[]>`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM memberships m
        WHERE m.status = 'ACTIVE'
          AND m.last_active_at >= date_trunc('month', now())
      ) AS current_mau,
      (
        SELECT COUNT(DISTINCT m.id)::int
        FROM memberships m
        JOIN user_roles ur ON ur.membership_id = m.id
        JOIN roles r ON r.id = ur.role_id AND r.key = 'learner'
        WHERE m.status = 'ACTIVE'
      ) AS total_learners,
      (
        SELECT COALESCE(SUM(size_bytes), 0)::float8 / 1e9
        FROM storage_references
        WHERE deleted_at IS NULL
      ) AS storage_gb,
      (
        SELECT COUNT(*)::int
        FROM courses
        WHERE status = 'PUBLISHED' AND deleted_at IS NULL
      ) AS products,
      (
        SELECT COUNT(*)::int
        FROM items
        WHERE deleted_at IS NULL
      ) AS questions,
      (
        SELECT COUNT(*)::int
        FROM attempts
        WHERE submitted_at IS NOT NULL
      ) AS test_submits
  `;

  const row = rows[0];

  return {
    currentMau: row?.current_mau ?? 0,
    totalLearners: row?.total_learners ?? 0,
    storageGb: row?.storage_gb ?? 0,
    products: row?.products ?? 0,
    questions: row?.questions ?? 0,
    testSubmits: row?.test_submits ?? 0,
  };
}

export type UsagePoint = { period: string; value: number };

/** Monthly active users (distinct active memberships) for the last 12 months. */
export async function getMauMonthly(tx: TenantTx): Promise<UsagePoint[]> {
  const rows = await tx.$queryRaw<Array<{ period: string; value: number }>>`
    SELECT
      to_char(date_trunc('month', day), 'YYYY-MM-DD') AS period,
      COUNT(DISTINCT membership_id)::int AS value
    FROM tenant_active_days
    WHERE day >= date_trunc('month', now()) - interval '11 months'
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map((row) => ({ period: row.period, value: row.value }));
}

/** Daily active users for the last 30 days. */
export async function getMauDaily(tx: TenantTx): Promise<UsagePoint[]> {
  const rows = await tx.$queryRaw<Array<{ period: string; value: number }>>`
    SELECT
      to_char(day, 'YYYY-MM-DD') AS period,
      COUNT(DISTINCT membership_id)::int AS value
    FROM tenant_active_days
    WHERE day >= current_date - 29
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map((row) => ({ period: row.period, value: row.value }));
}

export type GaugeSnapshotRow = { rollupKey: string; period: string; value: number };

/** Monthly gauge snapshots (storage, learners, products, questions, test submits). */
export async function getUsageGaugeHistory(tx: TenantTx): Promise<GaugeSnapshotRow[]> {
  const keys = Object.values(USAGE_SNAPSHOT_KEYS);
  const rows = await tx.$queryRaw<Array<{ rollup_key: string; period: string; value: number }>>`
    SELECT
      rollup_key,
      to_char(date_trunc('month', period_start), 'YYYY-MM-DD') AS period,
      COALESCE((metrics_json->>'value')::float8, 0) AS value
    FROM analytics_rollups
    WHERE rollup_key = ANY(${keys}::text[])
      AND period_start >= date_trunc('month', now()) - interval '11 months'
    ORDER BY period_start
  `;
  return rows.map((row) => ({ rollupKey: row.rollup_key, period: row.period, value: row.value }));
}

/** Monthly counter history (message sends, email validations) for the last 12 months. */
export async function getUsageCounterHistory(tx: TenantTx): Promise<GaugeSnapshotRow[]> {
  const keys = Object.values(USAGE_COUNTER_KEYS);
  const rows = await tx.$queryRaw<Array<{ rollup_key: string; period: string; value: number }>>`
    SELECT
      rollup_key,
      to_char(date_trunc('month', period_start), 'YYYY-MM-DD') AS period,
      COALESCE((metrics_json->>'count')::int, 0) AS value
    FROM analytics_rollups
    WHERE rollup_key = ANY(${keys}::text[])
      AND period_start >= date_trunc('month', now()) - interval '11 months'
    ORDER BY period_start
  `;
  return rows.map((row) => ({ rollupKey: row.rollup_key, period: row.period, value: row.value }));
}

/**
 * Increments a monthly usage counter in analytics_rollups (event-driven Tier-B
 * metric). Best-effort — callers should not let a metering failure break the
 * underlying action.
 */
export async function incrementUsageCounter(
  tx: TenantTx,
  rollupKey: string,
  delta = 1,
): Promise<void> {
  if (delta === 0) {
    return;
  }
  const id = randomUUID();
  await tx.$executeRaw`
    insert into analytics_rollups (
      id, tenant_id, rollup_key, subject_type, subject_id, period_start, period_end, metrics_json, calculated_at
    )
    values (
      ${id}::uuid,
      current_setting('app.tenant_id')::uuid,
      ${rollupKey},
      'tenant',
      current_setting('app.tenant_id'),
      date_trunc('month', now()),
      date_trunc('month', now()) + interval '1 month',
      jsonb_build_object('count', ${delta}::int),
      now()
    )
    on conflict (tenant_id, rollup_key, subject_type, subject_id, period_start)
    do update set
      metrics_json = jsonb_build_object(
        'count',
        coalesce((analytics_rollups.metrics_json->>'count')::int, 0) + ${delta}::int
      ),
      calculated_at = now()
  `;
}

/** Upserts a single monthly gauge snapshot into analytics_rollups (idempotent). */
export async function upsertUsageSnapshot(
  tx: TenantTx,
  rollupKey: string,
  value: number,
): Promise<void> {
  const id = randomUUID();
  await tx.$executeRaw`
    insert into analytics_rollups (
      id, tenant_id, rollup_key, subject_type, subject_id, period_start, period_end, metrics_json, calculated_at
    )
    values (
      ${id}::uuid,
      current_setting('app.tenant_id')::uuid,
      ${rollupKey},
      'tenant',
      current_setting('app.tenant_id'),
      date_trunc('month', now()),
      date_trunc('month', now()) + interval '1 month',
      jsonb_build_object('value', ${value}::float8),
      now()
    )
    on conflict (tenant_id, rollup_key, subject_type, subject_id, period_start)
    do update set
      metrics_json = jsonb_build_object('value', ${value}::float8),
      calculated_at = now()
  `;
}
