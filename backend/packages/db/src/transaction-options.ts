/**
 * Tenants.statement_timeout_ms defaults to 5000 — that is the Postgres
 * *per-statement* budget.
 *
 * Prisma interactive `$transaction` also defaults to timeout=5000, but every
 * `withTenantTx` / `withPlatformScope` / `withGlobalDb` call runs multiple
 * statements (role + GUC setup, then membership/authz/handler work). Under
 * remote-DB latency those multi-query routes routinely exceed 5s wall-clock
 * and fail with P2028 even when no individual statement is runaway.
 *
 * Keep the per-statement guard at the tenant default, and give the interactive
 * transaction a larger wall-clock budget sized for multi-RTT request work.
 */

/** Matches `tenants.statement_timeout_ms` schema default. */
export const DEFAULT_STATEMENT_TIMEOUT_MS = 5_000;

/** How long Prisma may wait for a free pool connection before starting. */
export const DEFAULT_TX_MAX_WAIT_MS = 10_000;

/**
 * Interactive transaction wall-clock for tenant routes.
 * Covers GUC setup + membership + authorization + typical handler queries.
 */
export const DEFAULT_TENANT_TX_TIMEOUT_MS = 30_000;

/** Platform scope also writes enter/exit audit rows inside the same ITX. */
export const DEFAULT_PLATFORM_TX_TIMEOUT_MS = 45_000;

/** Global (non-tenant) helpers are shorter-lived. */
export const DEFAULT_GLOBAL_TX_TIMEOUT_MS = 15_000;

export type InteractiveTxOptions = {
  maxWait: number;
  timeout: number;
};

export function resolveStatementTimeoutMs(override?: number | null): number {
  if (override == null || !Number.isFinite(override) || override <= 0) {
    return DEFAULT_STATEMENT_TIMEOUT_MS;
  }

  return Math.floor(override);
}

/**
 * Interactive timeout must stay above the per-statement budget so a healthy
 * multi-query request is not aborted mid-flight by Prisma's ITX timer.
 */
export function resolveInteractiveTimeoutMs(
  statementTimeoutMs: number,
  floorMs: number = DEFAULT_TENANT_TX_TIMEOUT_MS,
): number {
  const scaled = statementTimeoutMs * 4;
  return Math.max(floorMs, scaled);
}

export function interactiveTxOptions(timeoutMs: number): InteractiveTxOptions {
  return {
    maxWait: DEFAULT_TX_MAX_WAIT_MS,
    timeout: timeoutMs,
  };
}
