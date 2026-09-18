import type { TenantTx } from "@atlas/db";

/**
 * Per-tenant metering for quantitative entitlements (audit finding M11).
 *
 * Consumption is one `INSERT ... ON CONFLICT DO UPDATE` guarded by a `WHERE`,
 * not a read followed by a write. Two concurrent requests competing for the last
 * remaining unit therefore serialise on the unique index and exactly one
 * succeeds — the same reasoning that fixed the concurrent wallet spend (C2) and
 * coupon redemption (C3) earlier in this programme, applied before the same bug
 * could be written a third time.
 */

export type UsagePeriod = "day" | "month" | "total";

export type UsageSnapshot = {
  used: number;
  limit: number | null;
  period: UsagePeriod;
  periodStart: Date;
};

/** Postgres expression for the start of the window a period name describes. */
function periodStartSql(period: UsagePeriod): string {
  if (period === "day") return "date_trunc('day', now())";
  if (period === "month") return "date_trunc('month', now())";
  // A non-periodic entitlement still needs a row key, so it uses a fixed epoch.
  return "timestamptz 'epoch'";
}

export async function readEntitlementUsage(
  tx: TenantTx,
  args: { entitlementKey: string; period: UsagePeriod },
): Promise<UsageSnapshot | null> {
  const rows = await tx.$queryRawUnsafe<
    Array<{ used: bigint; limit_snapshot: bigint | null; period: string; period_start: Date }>
  >(
    `SELECT used, limit_snapshot, period, period_start
       FROM entitlement_usage
      WHERE entitlement_key = $1
        AND period_start = ${periodStartSql(args.period)}
      LIMIT 1`,
    args.entitlementKey,
  );

  const row = rows[0];
  if (!row) return null;

  return {
    used: Number(row.used),
    limit: row.limit_snapshot === null ? null : Number(row.limit_snapshot),
    period: row.period as UsagePeriod,
    periodStart: row.period_start,
  };
}

export type ConsumeResult =
  | { allowed: true; used: number; limit: number | null }
  | { allowed: false; used: number; limit: number };

/**
 * Atomically records `units` of consumption, refusing to exceed `limit`.
 *
 * When `limit` is null the counter still advances — metering a tenant is useful
 * even where nothing is capped, and it means turning a limit on later has
 * history behind it rather than starting from zero.
 */
export async function consumeEntitlementUsage(
  tx: TenantTx,
  args: {
    tenantId: string;
    entitlementKey: string;
    period: UsagePeriod;
    limit: number | null;
    units: number;
  },
): Promise<ConsumeResult> {
  if (args.units <= 0) {
    throw new Error("consumeEntitlementUsage requires a positive unit count");
  }

  const start = periodStartSql(args.period);

  // Both paths are guarded, and they have to be: a VALUES insert with only the
  // DO UPDATE guarded would let the *first* consumption of a period sail past
  // the limit, so a tenant with a limit of 10 could spend 500 in one call as
  // long as they did it before any counter row existed. The INSERT ... SELECT
  // form applies the same test to the row that opens the period.
  //
  // Either way, no row returned means the request would have gone over.
  const rows = await tx.$queryRawUnsafe<Array<{ used: bigint }>>(
    `INSERT INTO entitlement_usage (
       tenant_id, entitlement_key, period_start, period, used, limit_snapshot
     )
     SELECT $1::uuid, $2, ${start}, $3, $4::bigint, $5::bigint
      WHERE $5::bigint IS NULL OR $4::bigint <= $5::bigint
     ON CONFLICT (tenant_id, entitlement_key, period_start) DO UPDATE
       SET used = entitlement_usage.used + EXCLUDED.used,
           limit_snapshot = EXCLUDED.limit_snapshot,
           updated_at = now()
       WHERE $5::bigint IS NULL
          OR entitlement_usage.used + EXCLUDED.used <= $5::bigint
     RETURNING used`,
    args.tenantId,
    args.entitlementKey,
    args.period,
    args.units,
    args.limit,
  );

  const inserted = rows[0];
  if (inserted) {
    return { allowed: true, used: Number(inserted.used), limit: args.limit };
  }

  // No row came back: either the guard rejected the update, or the initial
  // insert itself would exceed the limit. Read the current figure so the caller
  // can tell the tenant where they stand rather than just "denied".
  const current = await readEntitlementUsage(tx, {
    entitlementKey: args.entitlementKey,
    period: args.period,
  });
  return {
    allowed: false,
    used: current?.used ?? 0,
    limit: args.limit ?? 0,
  };
}
