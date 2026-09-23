import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { appendDurableUsage } from "@atlas/db/metering-client";
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

/** No timer or in-memory backlog. A resolved true means the write was acknowledged. */
export function createDurableUsageRecorder(options: {
  writer: (event: UsageEvent) => Promise<void>;
  onError?: (error: unknown, event: UsageEvent) => void;
}) {
  return async (tenantId: string, increment: UsageIncrement, at = new Date()): Promise<boolean> => {
    if (!UUID_PATTERN.test(tenantId) || !Number.isFinite(at.getTime())) return false;
    const event: UsageEvent = {
      id: randomUUID(),
      tenantId,
      periodStart: new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1)),
      requests: Math.floor(positive(increment.requests)),
      emails: Math.floor(positive(increment.emails)),
      durationMs: positive(increment.durationMs),
    };
    if (!event.requests && !event.emails && !event.durationMs) return false;
    let failure: unknown;
    // A connection can fail after COMMIT. Keep one ID across both attempts.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await options.writer(event);
        return true;
      } catch (error) {
        failure = error;
      }
    }
    try {
      options.onError?.(failure, event);
    } catch {
      /* diagnostics must not replace a business response */
    }
    return false;
  };
}
const persist = createDurableUsageRecorder({
  writer: appendDurableUsage,
  onError: (_error, event) => {
    console.error(
      JSON.stringify({
        level: "error",
        message: "usage_meter.persistence_failed",
        tenantId: event.tenantId,
        eventId: event.id,
        timestamp: new Date().toISOString(),
      }),
    );
  },
});
export async function recordTenantUsage(
  tenantId: string,
  increment: UsageIncrement,
): Promise<void> {
  const setting = process.env["ATLAS_USAGE_METERING"]?.trim().toLowerCase();
  if (setting === "off" || (process.env["VITEST"] !== undefined && setting !== "on")) return;
  await persist(tenantId, increment);
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
/** Compatibility with graceful shutdown: every production record was already awaited. */
export async function flushTenantUsageMeter(): Promise<void> {
  await Promise.resolve();
}
