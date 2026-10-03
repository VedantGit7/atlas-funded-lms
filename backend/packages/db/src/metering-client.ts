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
export const USAGE_BATCH_DELAY_MS = 5;
export const USAGE_BATCH_MAX_EVENTS = 64;
export const USAGE_QUEUE_MAX_EVENTS = 1_024;
export const USAGE_QUEUE_TIMEOUT_MS = 500;
const USAGE_BATCH_CONCURRENCY = 2;

/** A rejected admission has not reached PostgreSQL and must never be acknowledged. */
export type UsageAdmissionReason = "capacity" | "deadline" | "closed" | "unknown";
export class UsageAdmissionError extends Error {
  constructor(
    message: string,
    readonly reason: UsageAdmissionReason = "unknown",
  ) {
    super(message);
  }
}

type PendingUsage = {
  event: DurableUsageEvent;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
  resolve: () => void;
  reject: (reason: unknown) => void;
};

/** Coalescing is only scheduling: callers retain an unresolved promise until COMMIT. */
export function createBoundedUsageBatcher(
  writer: (events: readonly DurableUsageEvent[]) => Promise<void>,
) {
  const tenants = new Map<string, PendingUsage[]>();
  const idleWaiters = new Set<() => void>();
  let retained = 0;
  let active = 0;
  let closed = false;
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  const totals = {
    acknowledgedEvents: 0,
    acknowledgedRequests: 0,
    acknowledgedEmails: 0,
    committedBatches: 0,
    failedBatchAttempts: 0,
    rejectedAdmissions: 0,
    rejectedCapacity: 0,
    rejectedDeadline: 0,
    rejectedClosed: 0,
  };

  function settled(count: number) {
    retained -= count;
    if (retained === 0) {
      for (const resolve of idleWaiters) resolve();
      idleWaiters.clear();
    }
  }

  function schedule() {
    if (!scheduled && tenants.size && active < USAGE_BATCH_CONCURRENCY) {
      // Keep the timer referenced: pending acknowledgements must keep CLI producers alive.
      scheduled = setTimeout(dispatch, USAGE_BATCH_DELAY_MS);
    }
  }

  function dispatch() {
    scheduled = undefined;
    while (active < USAGE_BATCH_CONCURRENCY && tenants.size) {
      const nextTenant = tenants.entries().next().value;
      if (!nextTenant) break;
      const [tenantId, queue] = nextTenant;
      tenants.delete(tenantId);
      const candidates = queue.splice(0, USAGE_BATCH_MAX_EVENTS);
      // Round-robin tenants so a busy tenant cannot starve another tenant's acknowledgement.
      if (queue.length) tenants.set(tenantId, queue);
      const batch = candidates.filter((entry) => {
        clearTimeout(entry.timer);
        if (entry.expiresAt > Date.now()) return true;
        entry.reject(new UsageAdmissionError("Usage metering queue deadline exceeded", "deadline"));
        totals.rejectedAdmissions++;
        totals.rejectedDeadline++;
        settled(1);
        return false;
      });
      if (!batch.length) continue;
      active++;
      void (async () => {
        try {
          await writer(batch.map((entry) => entry.event));
          totals.committedBatches++;
          for (const entry of batch) {
            totals.acknowledgedEvents++;
            totals.acknowledgedRequests += entry.event.requests;
            totals.acknowledgedEmails += entry.event.emails;
            entry.resolve();
          }
        } catch (error) {
          totals.failedBatchAttempts++;
          for (const entry of batch) entry.reject(error);
        } finally {
          active--;
          settled(batch.length);
          schedule();
        }
      })();
    }
  }

  function append(event: DurableUsageEvent): Promise<void> {
    if (closed) {
      totals.rejectedAdmissions++;
      totals.rejectedClosed++;
      return Promise.reject(new UsageAdmissionError("Usage metering is closed", "closed"));
    }
    if (retained >= USAGE_QUEUE_MAX_EVENTS) {
      totals.rejectedAdmissions++;
      totals.rejectedCapacity++;
      return Promise.reject(
        new UsageAdmissionError("Usage metering queue capacity exceeded", "capacity"),
      );
    }
    retained++;
    return new Promise<void>((resolve, reject) => {
      const entry: PendingUsage = {
        event,
        resolve,
        reject,
        expiresAt: Date.now() + USAGE_QUEUE_TIMEOUT_MS,
        timer: setTimeout(() => {
          const queue = tenants.get(event.tenantId);
          if (!queue) return;
          const index = queue.indexOf(entry);
          if (index < 0) return;
          queue.splice(index, 1);
          if (!queue.length) tenants.delete(event.tenantId);
          reject(new UsageAdmissionError("Usage metering queue deadline exceeded", "deadline"));
          totals.rejectedAdmissions++;
          totals.rejectedDeadline++;
          settled(1);
        }, USAGE_QUEUE_TIMEOUT_MS),
      };
      const queue = tenants.get(event.tenantId) ?? [];
      queue.push(entry);
      tenants.set(event.tenantId, queue);
      schedule();
    });
  }

  function flush(): Promise<void> {
    if (!retained) return Promise.resolve();
    return new Promise<void>((resolve) => idleWaiters.add(resolve));
  }

  return {
    append,
    flush,
    snapshot: () => ({ ...totals, retainedEvents: retained, activeBatches: active }),
    close: () => {
      closed = true;
      return flush();
    },
  };
}

declare global {
  var __atlasUsagePgPool: Pool | undefined;
  var __atlasUsageBatcher: ReturnType<typeof createBoundedUsageBatcher> | undefined;
  var __atlasUsageMetricsTimer: ReturnType<typeof setInterval> | undefined;
  var __atlasUsageMeteringClosed: boolean | undefined;
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
export function createDurableUsageBatchAppender(pool: Pick<Pool, "connect">) {
  return async (events: readonly DurableUsageEvent[]): Promise<void> => {
    const event = events[0];
    if (!event || events.length > USAGE_BATCH_MAX_EVENTS)
      throw new Error("Usage batch must contain between 1 and 64 events");
    if (events.some((item) => item.tenantId !== event.tenantId))
      throw new Error("Usage batch must contain events for the same tenant");
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
         SELECT item.id, $2::uuid, item.period_start, item.requests, item.duration_ms, item.emails
         FROM unnest($1::uuid[], $3::date[], $4::bigint[], $5::float8[], $6::bigint[])
           AS item(id, period_start, requests, duration_ms, emails)
         ON CONFLICT (id) DO NOTHING`,
        [
          events.map((item) => item.id),
          event.tenantId,
          events.map((item) => item.periodStart.toISOString().slice(0, 10)),
          events.map((item) => item.requests),
          events.map((item) => item.durationMs),
          events.map((item) => item.emails),
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

export function createDurableUsageAppender(pool: Pick<Pool, "connect">) {
  const append = createDurableUsageBatchAppender(pool);
  return (event: DurableUsageEvent): Promise<void> => append([event]);
}

export async function appendDurableUsage(event: DurableUsageEvent): Promise<void> {
  if (globalThis.__atlasUsageMeteringClosed)
    throw new UsageAdmissionError("Usage metering is closed", "closed");
  if (!globalThis.__atlasUsageBatcher) {
    globalThis.__atlasUsageBatcher = createBoundedUsageBatcher(
      createDurableUsageBatchAppender(getUsagePool()),
    );
    if (process.env["DATABASE_POOL_METRICS"] === "1") {
      globalThis.__atlasUsageMetricsTimer = setInterval(emitUsageMetrics, 60_000);
      globalThis.__atlasUsageMetricsTimer.unref();
    }
  }
  await globalThis.__atlasUsageBatcher.append(event);
}

function emitUsageMetrics(): void {
  if (!globalThis.__atlasUsageBatcher) return;
  console.info(
    JSON.stringify({
      event: "usage_meter_metrics",
      pid: process.pid,
      timestamp: new Date().toISOString(),
      ...globalThis.__atlasUsageBatcher.snapshot(),
    }),
  );
}

export async function flushUsageMetering(): Promise<void> {
  await globalThis.__atlasUsageBatcher?.flush();
}

/** Terminal for this process. Flush the recorder first to include delayed retries. */
export async function closeUsageMeteringPool(): Promise<void> {
  // Set before the first await: a delayed retry must not create a fresh pool.
  globalThis.__atlasUsageMeteringClosed = true;
  await globalThis.__atlasUsageBatcher?.close();
  if (globalThis.__atlasUsageMetricsTimer) {
    clearInterval(globalThis.__atlasUsageMetricsTimer);
    globalThis.__atlasUsageMetricsTimer = undefined;
    emitUsageMetrics();
  }
  globalThis.__atlasUsageBatcher = undefined;
  const pool = globalThis.__atlasUsagePgPool;
  globalThis.__atlasUsagePgPool = undefined;
  await pool?.end();
}
