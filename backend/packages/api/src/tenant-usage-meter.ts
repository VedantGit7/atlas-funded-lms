import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  addMeteredUsage,
  METERED_USAGE_KEYS,
} from "@atlas/domain-config/repositories/usage.repository";

/**
 * Per-tenant usage metering for cost attribution (DoD item 8).
 *
 * The architecture review: "only the *usage* side is metered; the *cost* side
 * isn't instrumented." Storage, members and domains can be read from tables that
 * already exist. Two drivers could not: how much server work each tenant causes,
 * and how many emails the platform pays to send on its behalf. Neither left a
 * per-tenant record anywhere.
 *
 * Counting happens in memory and is written in batches, never inside the
 * request. The obvious alternative -- an UPDATE on the tenant's monthly row in
 * every request's own transaction -- serialises all of a busy tenant's requests
 * on that one row lock, which would make cost measurement the platform's
 * bottleneck. Batching turns N writes per tenant into one per flush interval.
 *
 * The trade is precision on a crash: counts accumulated since the last flush are
 * lost if the process dies without flushing. For attributing a monthly bill that
 * is a rounding error, which is why this is acceptable here and would not be for
 * anything that is billed to a customer. Entitlement limits, which are, use the
 * transactional counter in entitlement_usage instead.
 */

export type UsageIncrement = {
  requests?: number;
  durationMs?: number;
  emails?: number;
};

type Bucket = { requests: number; durationMs: number; emails: number };

export type MeteredBatch = {
  tenantId: string;
  periodStart: Date;
  requests: number;
  durationMs: number;
  emails: number;
};

export type UsageBatchWriter = (batch: MeteredBatch) => Promise<void>;

export type TenantUsageMeter = {
  record(tenantId: string, increment: UsageIncrement, at?: Date): void;
  /** Writes everything accumulated so far. Failed batches are kept for the next flush. */
  flush(): Promise<{ written: number; failed: number }>;
  /** Number of tenant-month buckets waiting to be written. */
  pendingBuckets(): number;
  stop(): void;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function monthStartUtc(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

function nonNegativeFinite(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * The production writer: one tenant transaction per tenant-month, so the write
 * goes through the same RLS policy as every other tenant write. There is no
 * request actor for a background flush; `allowAnonymousTenantRead` is the flag
 * the outbox worker's retention tasks use for the same situation.
 */
export const writeMeteredBatch: UsageBatchWriter = async (batch) => {
  await withTenantTx(
    { tenantId: batch.tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
    async (tx) => {
      await addMeteredUsage(tx, {
        rollupKey: METERED_USAGE_KEYS.apiRequests,
        periodStart: batch.periodStart,
        count: batch.requests,
        durationMs: batch.durationMs,
      });
      await addMeteredUsage(tx, {
        rollupKey: METERED_USAGE_KEYS.emailsSent,
        periodStart: batch.periodStart,
        count: batch.emails,
        durationMs: 0,
      });
    },
  );
};

export function createTenantUsageMeter(options: {
  writer: UsageBatchWriter;
  /** Flush period. 0 disables the timer; flush() can still be called directly. */
  intervalMs: number;
  onError?: (error: unknown, batch: MeteredBatch) => void;
}): TenantUsageMeter {
  let buckets = new Map<string, Bucket>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let flushing: Promise<{ written: number; failed: number }> | null = null;

  function key(tenantId: string, periodStart: Date): string {
    return `${tenantId}|${periodStart.toISOString()}`;
  }

  function add(bucketKey: string, increment: Bucket): void {
    const existing = buckets.get(bucketKey);
    if (existing) {
      existing.requests += increment.requests;
      existing.durationMs += increment.durationMs;
      existing.emails += increment.emails;
    } else {
      buckets.set(bucketKey, { ...increment });
    }
  }

  function ensureTimer(): void {
    if (timer !== null || options.intervalMs <= 0) return;
    timer = setInterval(() => {
      void flush();
    }, options.intervalMs);
    // Never keep a process alive just to report on it.
    timer.unref();
  }

  async function flushOnce(): Promise<{ written: number; failed: number }> {
    const pending = buckets;
    buckets = new Map();
    let written = 0;
    let failed = 0;

    for (const [bucketKey, bucket] of pending) {
      const [tenantId, periodIso] = bucketKey.split("|") as [string, string];
      const batch: MeteredBatch = {
        tenantId,
        periodStart: new Date(periodIso),
        requests: bucket.requests,
        durationMs: bucket.durationMs,
        emails: bucket.emails,
      };
      try {
        await options.writer(batch);
        written += 1;
      } catch (error) {
        failed += 1;
        // Put the counts back so a database blip delays them instead of
        // dropping them. Merged, because new requests may have arrived for the
        // same bucket while this flush was running.
        add(bucketKey, bucket);
        options.onError?.(error, batch);
      }
    }

    return { written, failed };
  }

  function flush(): Promise<{ written: number; failed: number }> {
    // One flush at a time. A second flush started while the first is still
    // writing would run concurrently with the first one's re-queueing of failed
    // buckets, and two writers for the same tenant-month would contend on the
    // same rollup row for no benefit.
    if (flushing) return flushing;
    flushing = flushOnce().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  return {
    record(tenantId, increment, at = new Date()) {
      if (!UUID_PATTERN.test(tenantId)) return;
      const bucket: Bucket = {
        requests: nonNegativeFinite(increment.requests),
        durationMs: nonNegativeFinite(increment.durationMs),
        emails: nonNegativeFinite(increment.emails),
      };
      if (bucket.requests === 0 && bucket.durationMs === 0 && bucket.emails === 0) return;
      add(key(tenantId, monthStartUtc(at)), bucket);
      ensureTimer();
    },
    flush,
    pendingBuckets: () => buckets.size,
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Process-wide instance
// ---------------------------------------------------------------------------

/**
 * Metering is on unless `ATLAS_USAGE_METERING=off`. Under Vitest it defaults to
 * off: route tests run the real tenant route wrapper against fixture tenant ids
 * that have no row in `tenants`, and a background flush would write rollups for
 * them or log a foreign-key failure into unrelated test output. Tests of the
 * meter build their own instance with createTenantUsageMeter.
 */
function meteringEnabled(env: NodeJS.ProcessEnv): boolean {
  const setting = env["ATLAS_USAGE_METERING"]?.trim().toLowerCase();
  if (setting === "off") return false;
  if (setting === "on") return true;
  return env["VITEST"] === undefined;
}

const FLUSH_INTERVAL_MS = 60_000;

/**
 * Held on globalThis rather than in module scope. Next.js may bundle this module
 * into more than one route chunk, and module-level state would then give each
 * route its own meter, each flushing its own partial count.
 */
const GLOBAL_KEY = Symbol.for("atlas.tenantUsageMeter");

type GlobalWithMeter = typeof globalThis & { [GLOBAL_KEY]?: TenantUsageMeter | null };

function processMeter(): TenantUsageMeter | null {
  const store = globalThis as GlobalWithMeter;
  if (store[GLOBAL_KEY] === undefined) {
    store[GLOBAL_KEY] = meteringEnabled(process.env)
      ? createTenantUsageMeter({
          writer: writeMeteredBatch,
          intervalMs: FLUSH_INTERVAL_MS,
          onError: (error, batch) => {
            console.error(
              JSON.stringify({
                level: "error",
                message: "usage_meter.flush_failed",
                module: "tenant-usage-meter",
                // The tenant id is already an opaque uuid and is the only way to
                // find which rollup is short; no personal data is involved.
                tenantId: batch.tenantId,
                error: error instanceof Error ? error.message.slice(0, 300) : "unknown",
                timestamp: new Date().toISOString(),
              }),
            );
          },
        })
      : null;
  }
  return store[GLOBAL_KEY] ?? null;
}

/** Records usage against a tenant. Never throws: metering must not fail a request. */
export function recordTenantUsage(tenantId: string, increment: UsageIncrement): void {
  try {
    processMeter()?.record(tenantId, increment);
  } catch {
    // Deliberately swallowed. See the file comment.
  }
}

/** Writes pending usage now. Call on graceful shutdown so the last minute is kept. */
export async function flushTenantUsageMeter(): Promise<void> {
  const meter = processMeter();
  if (!meter) return;
  meter.stop();
  await meter.flush();
}
