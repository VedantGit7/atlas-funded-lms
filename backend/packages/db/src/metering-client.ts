import { Pool } from "pg";
import { instrumentPool } from "./pool-instrumentation";

export type DurableUsageEvent = {
  id: string;
  tenantId: string;
  periodStart: Date;
  requests: number;
  durationMs: number;
  emails: number;
};

export const USAGE_ACQUIRE_TIMEOUT_MS = 500;
export const USAGE_TRANSACTION_TIMEOUT_MS = 1_500;

declare global {
  var __atlasUsagePgPool: Pool | undefined;
}

export function resolveUsagePoolMax(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 8) : 2;
}

function getUsagePool(): Pool {
  if (!globalThis.__atlasUsagePgPool) {
    const connectionString = process.env["DATABASE_URL"];
    if (!connectionString) throw new Error("Missing DATABASE_URL for usage metering");

    // Never acquire the business pool: some email callers already hold one of
    // its connections. This independent, small pool breaks that resource cycle.
    const pool = new Pool({
      connectionString,
      max: resolveUsagePoolMax(process.env["USAGE_DATABASE_POOL_MAX"]),
      connectionTimeoutMillis: USAGE_ACQUIRE_TIMEOUT_MS,
      statement_timeout: 750,
      idle_in_transaction_session_timeout: 1_000,
      idleTimeoutMillis: 10_000,
      application_name: "atlas-usage-meter",
    });
    // pg emits errors for idle connections separately from awaited queries.
    // Do not log the error object: connection errors can include credentials.
    pool.on("error", () => {
      console.error("usage_meter.idle_connection_failed");
    });
    globalThis.__atlasUsagePgPool = pool;
  }
  instrumentPool(globalThis.__atlasUsagePgPool, {
    enabled: process.env["DATABASE_POOL_METRICS"] === "1",
    poolName: "usage",
  });
  return globalThis.__atlasUsagePgPool;
}

/** Injectable pool boundary; all SQL stays parameterized and tenant scoped. */
export function createDurableUsageAppender(pool: Pick<Pool, "connect">) {
  return async (event: DurableUsageEvent): Promise<void> => {
    const client = await pool.connect();
    const state = { released: false, expired: false };
    let committed = false;
    const deadline = setTimeout(() => {
      state.expired = true;
      state.released = true;
      // pg release(true) removes the client and forcibly destroys its socket
      // when a query is active. Await that query below; never race it and leave
      // a transaction running. A lost COMMIT reply is retried with the same ID.
      client.release(true);
    }, USAGE_TRANSACTION_TIMEOUT_MS);

    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE atlas_app");
      await client.query(
        `SELECT set_config('app.tenant_id', $1, true),
          set_config('app.actor_membership_id', '', true),
          set_config('app.request_id', $2, true),
          set_config('statement_timeout', '750', true),
          set_config('lock_timeout', '250', true),
          set_config('idle_in_transaction_session_timeout', '1000', true)`,
        [event.tenantId, event.id],
      );
      await client.query(
        `INSERT INTO tenant_usage_events (id, tenant_id, period_start, requests, duration_ms, emails)
         VALUES ($1::uuid, $2::uuid, $3::date, $4::bigint, $5::float8, $6::bigint)
         ON CONFLICT (id) DO NOTHING`,
        [
          event.id,
          event.tenantId,
          event.periodStart.toISOString().slice(0, 10),
          event.requests,
          event.durationMs,
          event.emails,
        ],
      );
      await client.query("COMMIT");
      committed = true;
    } catch (error) {
      if (state.expired)
        throw new Error("Usage metering transaction deadline exceeded", { cause: error });
      throw error;
    } finally {
      clearTimeout(deadline);
      // Discard failures instead of issuing another potentially blocked query.
      // Closing a connection with an open transaction rolls it back on the DB.
      if (!state.released) client.release(!committed);
    }
  };
}

export async function appendDurableUsage(event: DurableUsageEvent): Promise<void> {
  await createDurableUsageAppender(getUsagePool())(event);
}

/** Stop producers before calling this during controlled shutdown or CLI tests. */
export async function closeUsageMeteringPool(): Promise<void> {
  const pool = globalThis.__atlasUsagePgPool;
  globalThis.__atlasUsagePgPool = undefined;
  await pool?.end();
}
