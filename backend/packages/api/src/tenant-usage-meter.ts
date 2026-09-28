import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  appendDurableUsage,
  flushUsageMetering,
  UsageAdmissionError,
} from "@atlas/db/metering-client";
import {
  addMeteredUsage,
  METERED_USAGE_KEYS,
} from "@atlas/domain-config/repositories/usage.repository";

/** Operational cost attribution. Customer billing uses its separate transactional ledger. */
export type UsageIncrement = { requests?: number; durationMs?: number; emails?: number };
export type MeteredBatch = {
  tenantId: string;
  periodStart: Date;
  requests: number;
  durationMs: number;
  emails: number;
};
export type UsageEvent = MeteredBatch & { id: string };
export type UsageBatchWriter = (batch: MeteredBatch) => Promise<void>;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function positive(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? Math.min(value, Number.MAX_SAFE_INTEGER)
    : 0;
}

function createUsageEvent(
  tenantId: string,
  increment: UsageIncrement,
  at = new Date(),
): UsageEvent | undefined {
  if (!UUID_PATTERN.test(tenantId) || !Number.isFinite(at.getTime())) return;
  const event: UsageEvent = {
    id: randomUUID(),
    tenantId,
    periodStart: new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1)),
    requests: Math.floor(positive(increment.requests)),
    emails: Math.floor(positive(increment.emails)),
    durationMs: positive(increment.durationMs),
  };
  return event.requests || event.emails || event.durationMs ? event : undefined;
}

async function addBatch(tx: TenantTx, batch: MeteredBatch): Promise<void> {
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
}
/** Explicit rollup utility retained for operational imports and cost tests. */
export const writeMeteredBatch: UsageBatchWriter = (batch) =>
  withTenantTx(
    { tenantId: batch.tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
    (tx) => addBatch(tx, batch),
  );

export async function appendTenantUsageEvent(tx: TenantTx, event: UsageEvent): Promise<void> {
  await tx.$executeRaw`INSERT INTO tenant_usage_events(id,tenant_id,period_start,requests,duration_ms,emails)
    VALUES(${event.id}::uuid,${event.tenantId}::uuid,${event.periodStart}::date,${event.requests}::bigint,${event.durationMs}::float8,${event.emails}::bigint)
    ON CONFLICT(id) DO NOTHING`;
}

/** A resolved true means PostgreSQL acknowledged the commit, including any coalescing delay. */
export function createDurableUsageRecorder(options: {
  writer: (event: UsageEvent) => Promise<void>;
  onError?: (error: unknown, event: UsageEvent) => void;
}) {
  let active = 0;
  let draining: { promise: Promise<void>; resolve: () => void } | undefined;
  const recordOne = async (event: UsageEvent): Promise<boolean> => {
    let failure: unknown;
    // A connection can fail after COMMIT. Keep one ID across both attempts.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await options.writer(event);
        return true;
      } catch (error) {
        failure = error;
        // Retrying admission immediately would amplify pressure without resolving
        // an ambiguous commit. Database failures retain the original ID on retry.
        if (error instanceof UsageAdmissionError) break;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
    try {
      options.onError?.(failure, event);
    } catch {
      /* diagnostics must not replace a business response */
    }
    return false;
  };
  const recordEvent = (event: UsageEvent): Promise<boolean> => {
    active++;
    return recordOne(event).finally(() => {
      active--;
      if (active === 0) {
        draining?.resolve();
        draining = undefined;
      }
    });
  };
  const record = (
    tenantId: string,
    increment: UsageIncrement,
    at = new Date(),
  ): Promise<boolean> => {
    const event = createUsageEvent(tenantId, increment, at);
    return event ? recordEvent(event) : Promise.resolve(false);
  };
  return Object.assign(record, {
    recordEvent,
    flush: (): Promise<void> => {
      if (!active) return Promise.resolve();
      if (!draining) {
        let resolve = () => {};
        const promise = new Promise<void>((done) => {
          resolve = done;
        });
        draining = { promise, resolve };
      }
      return draining.promise;
    },
  });
}
declare global {
  var __atlasUsageRecorder: ReturnType<typeof createDurableUsageRecorder> | undefined;
}
// Match the process-wide batcher lifecycle, including module reloads and split bundles.
const persist = (globalThis.__atlasUsageRecorder ??= createDurableUsageRecorder({
  writer: appendDurableUsage,
  onError: (error, event) => {
    console.error(
      JSON.stringify({
        level: "error",
        message: "usage_meter.persistence_failed",
        tenantId: event.tenantId,
        eventId: event.id,
        failureKind: error instanceof UsageAdmissionError ? "admission" : "database",
        admissionReason: error instanceof UsageAdmissionError ? error.reason : undefined,
        timestamp: new Date().toISOString(),
      }),
    );
  },
}));
export async function recordTenantUsage(
  tenantId: string,
  increment: UsageIncrement,
): Promise<void> {
  if (!usageMeteringEnabled()) return;
  await persist(tenantId, increment);
}

function usageMeteringEnabled(): boolean {
  const setting = process.env["ATLAS_USAGE_METERING"]?.trim().toLowerCase();
  return setting !== "off" && (process.env["VITEST"] === undefined || setting === "on");
}

/**
 * Journal successful requests inside their business transaction. Call committed()
 * only after the transaction resolves; an uncertain COMMIT falls back with the
 * identical event, so PostgreSQL deduplicates it even if the first commit won.
 * Successful duration stops before journal insertion/commit/output serialization.
 * Failed requests retain bounded, explicitly best-effort operational recording.
 */
export function createTenantRequestUsage(tenantId: string) {
  const enabled = usageMeteringEnabled();
  let event: UsageEvent | undefined;
  let committed = false;
  return {
    async append(tx: TenantTx, increment: UsageIncrement): Promise<void> {
      if (!enabled) return;
      event ??= createUsageEvent(tenantId, increment);
      if (!event) throw new Error("Invalid transactional usage event");
      await appendTenantUsageEvent(tx, event);
    },
    committed(): void {
      committed = true;
    },
    async fallback(increment: UsageIncrement): Promise<boolean> {
      if (!enabled || committed) return true;
      event ??= createUsageEvent(tenantId, increment);
      return event ? persist.recordEvent(event) : false;
    },
  };
}

/** Caller must use one tenant transaction: locks, increments and acknowledgement commit together. */
export async function drainTenantUsageEvents(
  tx: TenantTx,
  options: { limit: number },
): Promise<{ processed: number }> {
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 1000)
    throw new Error("Usage drain limit must be between 1 and 1000");
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      period_start: Date;
      requests: number;
      duration_ms: number;
      emails: number;
    }>
  >`
    SELECT id::text,tenant_id::text,period_start,requests::float8,duration_ms,emails::float8 FROM tenant_usage_events
    WHERE processed_at IS NULL ORDER BY created_at,id LIMIT ${options.limit} FOR UPDATE SKIP LOCKED`;
  const groups = new Map<string, MeteredBatch>();
  for (const row of rows) {
    const key = row.tenant_id + "|" + row.period_start.toISOString();
    const group = groups.get(key) ?? {
      tenantId: row.tenant_id,
      periodStart: row.period_start,
      requests: 0,
      durationMs: 0,
      emails: 0,
    };
    group.requests += row.requests;
    group.durationMs += row.duration_ms;
    group.emails += row.emails;
    groups.set(key, group);
  }
  // Stable lock order for workers holding distinct event batches in the same months.
  for (const [, batch] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)))
    await addBatch(tx, batch);
  const ids = rows.map((row) => row.id);
  if (ids.length)
    await tx.$executeRaw`UPDATE tenant_usage_events SET processed_at=now() WHERE id=ANY(${ids}::uuid[])`;
  // Retain acknowledgement IDs for retries, then prune only old processed entries.
  await tx.$executeRaw`DELETE FROM tenant_usage_events WHERE id IN (
    SELECT id FROM tenant_usage_events WHERE processed_at<now()-interval '30 days'
    ORDER BY processed_at,id LIMIT ${options.limit} FOR UPDATE SKIP LOCKED)`;
  return { processed: rows.length };
}
/** Stop producers first. Wait for every admitted write to acknowledge or report failure. */
export async function flushTenantUsageMeter(): Promise<void> {
  // A settled batch can still have a recorder waiting to retry or report failure.
  await persist.flush();
  await flushUsageMetering();
}
