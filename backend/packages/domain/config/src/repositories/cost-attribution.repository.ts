import type { PlatformTx } from "@atlas/db";
import type { AllocationKey, CostDriverKey, TenantUsage } from "../cost-attribution";
import { METERED_USAGE_KEYS } from "./usage.repository";

/**
 * Cross-tenant reads and rate-card writes for cost attribution (DoD item 8).
 *
 * Runs as atlas_platform inside withPlatformScope, so every tenant table is
 * readable through its `_platform_scope` policy, and the two cost tables are
 * readable at all -- the tenant roles have no privileges on them.
 *
 * Each usage query aggregates across all tenants in one statement grouped by
 * tenant_id, rather than one query per tenant, so the report costs a fixed
 * number of round trips however many tenants there are.
 */

export type MonthWindow = {
  /** First instant of the month, UTC. */
  start: Date;
  /** First instant of the next month, UTC. */
  end: Date;
  /**
   * The instant point-in-time measures (storage, domains) are taken at: the end
   * of the month, or now if the month is still running. Taking them at the end
   * of a future instant would count objects that do not exist yet.
   */
  snapshotAt: Date;
};

export type TenantRow = {
  tenantId: string;
  slug: string;
  displayName: string;
  state: string;
};

/** Tenants that existed at any point during the month. */
export async function listTenantsInMonth(
  tx: PlatformTx,
  window: MonthWindow,
): Promise<TenantRow[]> {
  const rows = await tx.$queryRaw<
    Array<{ id: string; slug: string; display_name: string; state: string }>
  >`
    SELECT id::text, slug, display_name, state::text
    FROM tenants
    WHERE created_at < ${window.end}
      AND (deleted_at IS NULL OR deleted_at >= ${window.start})
    ORDER BY display_name ASC
  `;
  return rows.map((row) => ({
    tenantId: row.id,
    slug: row.slug,
    displayName: row.display_name,
    state: row.state,
  }));
}

function emptyUsage(): TenantUsage {
  return {
    activeMembers: 0,
    memberDays: 0,
    apiRequests: 0,
    apiServerMs: 0,
    storageGb: 0,
    emailsSent: 0,
    customDomains: 0,
  };
}

/**
 * Measured usage for every tenant with any usage in the month. Tenants absent
 * from the map had none.
 */
export async function readUsageByTenant(
  tx: PlatformTx,
  window: MonthWindow,
): Promise<Map<string, TenantUsage>> {
  const usage = new Map<string, TenantUsage>();
  const forTenant = (tenantId: string): TenantUsage => {
    let entry = usage.get(tenantId);
    if (!entry) {
      entry = emptyUsage();
      usage.set(tenantId, entry);
    }
    return entry;
  };

  // `day` is a date column; the month bounds are passed as dates so the
  // comparison does not depend on the session time zone.
  const startDay = window.start.toISOString().slice(0, 10);
  const endDay = window.end.toISOString().slice(0, 10);

  const [members, requests, emails, storage, domains] = await Promise.all([
    tx.$queryRaw<Array<{ tenant_id: string; active_members: number; member_days: number }>>`
      SELECT tenant_id::text,
             COUNT(DISTINCT membership_id)::int AS active_members,
             COUNT(*)::int AS member_days
      FROM tenant_active_days
      WHERE day >= ${startDay}::date AND day < ${endDay}::date
      GROUP BY tenant_id
    `,
    tx.$queryRaw<Array<{ tenant_id: string; requests: bigint; duration_ms: bigint }>>`
      SELECT tenant_id::text,
             COALESCE((metrics_json->>'count')::bigint, 0) AS requests,
             COALESCE((metrics_json->>'durationMs')::bigint, 0) AS duration_ms
      FROM analytics_rollups
      WHERE rollup_key = ${METERED_USAGE_KEYS.apiRequests}
        AND subject_type = 'tenant'
        AND period_start = ${window.start}
    `,
    tx.$queryRaw<Array<{ tenant_id: string; emails: bigint }>>`
      SELECT tenant_id::text,
             COALESCE((metrics_json->>'count')::bigint, 0) AS emails
      FROM analytics_rollups
      WHERE rollup_key = ${METERED_USAGE_KEYS.emailsSent}
        AND subject_type = 'tenant'
        AND period_start = ${window.start}
    `,
    // Bytes that were actually uploaded and not yet deleted at the snapshot.
    // PENDING_UPLOAD rows are signed-URL reservations that may never have been
    // used, so they are excluded; a row deleted after the snapshot still counts,
    // because it was being stored at that instant. A DELETED row with no
    // deleted_at is treated as gone rather than as stored forever.
    tx.$queryRaw<Array<{ tenant_id: string; storage_gb: number }>>`
      SELECT tenant_id::text,
             COALESCE(SUM(size_bytes), 0)::float8 / 1e9 AS storage_gb
      FROM storage_references
      WHERE status <> 'PENDING_UPLOAD'
        AND created_at < ${window.snapshotAt}
        AND (
          (deleted_at IS NULL AND status <> 'DELETED')
          OR deleted_at >= ${window.snapshotAt}
        )
      GROUP BY tenant_id
    `,
    tx.$queryRaw<Array<{ tenant_id: string; custom_domains: number }>>`
      SELECT tenant_id::text, COUNT(*)::int AS custom_domains
      FROM tenant_domains
      WHERE type = 'CUSTOM_DOMAIN'
        AND status = 'ACTIVE'::"DomainStatus"
        AND created_at < ${window.snapshotAt}
        AND (deleted_at IS NULL OR deleted_at >= ${window.snapshotAt})
      GROUP BY tenant_id
    `,
  ]);

  for (const row of members) {
    const entry = forTenant(row.tenant_id);
    entry.activeMembers = row.active_members;
    entry.memberDays = row.member_days;
  }
  for (const row of requests) {
    const entry = forTenant(row.tenant_id);
    entry.apiRequests = Number(row.requests);
    entry.apiServerMs = Number(row.duration_ms);
  }
  for (const row of emails) {
    forTenant(row.tenant_id).emailsSent = Number(row.emails);
  }
  for (const row of storage) {
    forTenant(row.tenant_id).storageGb = row.storage_gb;
  }
  for (const row of domains) {
    forTenant(row.tenant_id).customDomains = row.custom_domains;
  }

  return usage;
}

export type RateRow = {
  id: string;
  driver: CostDriverKey;
  unitCostUsd: number;
  effectiveFrom: string;
  reason: string;
  createdAt: Date;
};

type RawRateRow = {
  id: string;
  driver: string;
  unit_cost_usd: string;
  effective_from: string;
  reason: string;
  created_at: Date;
};

function mapRate(row: RawRateRow): RateRow {
  return {
    id: row.id,
    driver: row.driver as CostDriverKey,
    unitCostUsd: Number(row.unit_cost_usd),
    effectiveFrom: row.effective_from,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

/**
 * The rate in force for each driver in a month: the latest effective_from not
 * after the month, and among rows for that same month the last inserted, which
 * is how a correction supersedes a mistyped rate without editing it. Ordered by
 * seq rather than created_at, which ties inside a single transaction.
 */
export async function readRatesInForce(tx: PlatformTx, monthStart: Date): Promise<RateRow[]> {
  const month = monthStart.toISOString().slice(0, 10);
  const rows = await tx.$queryRaw<RawRateRow[]>`
    SELECT DISTINCT ON (driver)
           id::text, driver, unit_cost_usd::text,
           to_char(effective_from, 'YYYY-MM') AS effective_from,
           reason, created_at
    FROM platform_cost_rates
    WHERE effective_from <= ${month}::date
    ORDER BY driver, effective_from DESC, seq DESC
  `;
  return rows.map(mapRate);
}

export async function listRateHistory(tx: PlatformTx, limit: number): Promise<RateRow[]> {
  const rows = await tx.$queryRaw<RawRateRow[]>`
    SELECT id::text, driver, unit_cost_usd::text,
           to_char(effective_from, 'YYYY-MM') AS effective_from,
           reason, created_at
    FROM platform_cost_rates
    ORDER BY effective_from DESC, seq DESC
    LIMIT ${limit}
  `;
  return rows.map(mapRate);
}

export async function insertRate(
  tx: PlatformTx,
  input: {
    driver: CostDriverKey;
    unitCostUsd: string;
    effectiveFrom: Date;
    reason: string;
    createdByPrincipalId: string;
  },
): Promise<RateRow> {
  const month = input.effectiveFrom.toISOString().slice(0, 10);
  const rows = await tx.$queryRaw<RawRateRow[]>`
    INSERT INTO platform_cost_rates (driver, unit_cost_usd, effective_from, reason, created_by_principal_id)
    VALUES (${input.driver}, ${input.unitCostUsd}::numeric, ${month}::date, ${input.reason}, ${input.createdByPrincipalId}::uuid)
    RETURNING id::text, driver, unit_cost_usd::text,
              to_char(effective_from, 'YYYY-MM') AS effective_from,
              reason, created_at
  `;
  const row = rows[0];
  if (!row) throw new Error("Cost rate insert returned no row");
  return mapRate(row);
}

export type FixedCostRow = {
  id: string;
  label: string;
  monthlyCostUsd: number;
  allocationKey: AllocationKey;
  effectiveFrom: string;
  effectiveUntil: string | null;
  reason: string;
  createdAt: Date;
};

type RawFixedCostRow = {
  id: string;
  label: string;
  monthly_cost_usd: string;
  allocation_key: string;
  effective_from: string;
  effective_until: string | null;
  reason: string;
  created_at: Date;
};

function mapFixedCost(row: RawFixedCostRow): FixedCostRow {
  return {
    id: row.id,
    label: row.label,
    monthlyCostUsd: Number(row.monthly_cost_usd),
    allocationKey: row.allocation_key as AllocationKey,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

/** Fixed cost lines that apply to the month (inclusive at both ends). */
export async function readFixedCostsInForce(
  tx: PlatformTx,
  monthStart: Date,
): Promise<FixedCostRow[]> {
  const month = monthStart.toISOString().slice(0, 10);
  const rows = await tx.$queryRaw<RawFixedCostRow[]>`
    SELECT id::text, label, monthly_cost_usd::text, allocation_key,
           to_char(effective_from, 'YYYY-MM') AS effective_from,
           to_char(effective_until, 'YYYY-MM') AS effective_until,
           reason, created_at
    FROM platform_fixed_costs
    WHERE effective_from <= ${month}::date
      AND (effective_until IS NULL OR effective_until >= ${month}::date)
    ORDER BY created_at ASC
  `;
  return rows.map(mapFixedCost);
}

export async function listFixedCosts(tx: PlatformTx): Promise<FixedCostRow[]> {
  const rows = await tx.$queryRaw<RawFixedCostRow[]>`
    SELECT id::text, label, monthly_cost_usd::text, allocation_key,
           to_char(effective_from, 'YYYY-MM') AS effective_from,
           to_char(effective_until, 'YYYY-MM') AS effective_until,
           reason, created_at
    FROM platform_fixed_costs
    ORDER BY (effective_until IS NULL) DESC, effective_from DESC, created_at DESC
  `;
  return rows.map(mapFixedCost);
}

export async function insertFixedCost(
  tx: PlatformTx,
  input: {
    label: string;
    monthlyCostUsd: string;
    allocationKey: AllocationKey;
    effectiveFrom: Date;
    reason: string;
    createdByPrincipalId: string;
  },
): Promise<FixedCostRow> {
  const month = input.effectiveFrom.toISOString().slice(0, 10);
  const rows = await tx.$queryRaw<RawFixedCostRow[]>`
    INSERT INTO platform_fixed_costs (
      label, monthly_cost_usd, allocation_key, effective_from, reason, created_by_principal_id
    )
    VALUES (
      ${input.label}, ${input.monthlyCostUsd}::numeric, ${input.allocationKey},
      ${month}::date, ${input.reason}, ${input.createdByPrincipalId}::uuid
    )
    RETURNING id::text, label, monthly_cost_usd::text, allocation_key,
              to_char(effective_from, 'YYYY-MM') AS effective_from,
              to_char(effective_until, 'YYYY-MM') AS effective_until,
              reason, created_at
  `;
  const row = rows[0];
  if (!row) throw new Error("Fixed cost insert returned no row");
  return mapFixedCost(row);
}

export async function findFixedCost(tx: PlatformTx, id: string): Promise<FixedCostRow | null> {
  const rows = await tx.$queryRaw<RawFixedCostRow[]>`
    SELECT id::text, label, monthly_cost_usd::text, allocation_key,
           to_char(effective_from, 'YYYY-MM') AS effective_from,
           to_char(effective_until, 'YYYY-MM') AS effective_until,
           reason, created_at
    FROM platform_fixed_costs
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  return row ? mapFixedCost(row) : null;
}

/**
 * Ends an open line. Guarded on `effective_until IS NULL` in the statement
 * itself, so two operators ending the same line concurrently cannot both
 * succeed and leave the history saying it ended twice.
 */
export async function endFixedCost(
  tx: PlatformTx,
  input: { id: string; effectiveUntil: Date; endedByPrincipalId: string },
): Promise<FixedCostRow | null> {
  const month = input.effectiveUntil.toISOString().slice(0, 10);
  const rows = await tx.$queryRaw<RawFixedCostRow[]>`
    UPDATE platform_fixed_costs
    SET effective_until = ${month}::date,
        ended_by_principal_id = ${input.endedByPrincipalId}::uuid,
        updated_at = now()
    WHERE id = ${input.id}::uuid
      AND effective_until IS NULL
      AND effective_from <= ${month}::date
    RETURNING id::text, label, monthly_cost_usd::text, allocation_key,
              to_char(effective_from, 'YYYY-MM') AS effective_from,
              to_char(effective_until, 'YYYY-MM') AS effective_until,
              reason, created_at
  `;
  const row = rows[0];
  return row ? mapFixedCost(row) : null;
}
