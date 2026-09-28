import { afterEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import {
  appendDurableUsage,
  closeUsageMeteringPool,
  createDurableUsageAppender,
  createDurableUsageBatchAppender,
  resolveUsagePoolMax,
  USAGE_ACQUIRE_TIMEOUT_MS,
  USAGE_TRANSACTION_TIMEOUT_MS,
} from "@atlas/db/metering-client";

const event = {
  id: "018f0000-0000-7000-8000-000000000001",
  tenantId: "018f0000-0000-7000-8000-000000000002",
  periodStart: new Date("2026-09-01T00:00:00Z"),
  requests: 1,
  durationMs: 12.5,
  emails: 0,
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function connection(options: { delayMs?: number; failInsert?: boolean } = {}) {
  let rejectPending: ((reason: Error) => void) | undefined;
  let queryTimer: ReturnType<typeof setTimeout> | undefined;
  const query = vi.fn(async (sql: string, _values?: unknown[]) => {
    if (options.delayMs) {
      await new Promise<void>((resolve, reject) => {
        rejectPending = reject;
        queryTimer = setTimeout(resolve, options.delayMs);
      });
      rejectPending = undefined;
    }
    if (options.failInsert && sql.includes("INSERT INTO")) throw new Error("insert failed");
    return { rows: [], rowCount: 1 };
  });
  const release = vi.fn((destroy?: boolean) => {
    if (destroy) {
      clearTimeout(queryTimer);
      rejectPending?.(new Error("connection destroyed"));
    }
  });
  const connect = vi.fn(async () => ({ query, release }));
  const pool = {
    connect,
    end: vi.fn(async () => {}),
    totalCount: 1,
    idleCount: 0,
    waitingCount: 0,
  } as unknown as Pool;
  return { pool, query, release, connect };
}

describe("isolated durable usage connection", () => {
  it("does not resurrect the pool for a delayed retry after close", async () => {
    vi.useFakeTimers();
    const previousPool = globalThis.__atlasUsagePgPool;
    const previousClosed = globalThis.__atlasUsageMeteringClosed;
    const db = connection({ failInsert: true });
    globalThis.__atlasUsagePgPool = db.pool;
    try {
      const first = expect(appendDurableUsage(event)).rejects.toThrow("insert failed");
      await vi.advanceTimersByTimeAsync(5);
      await first;
      await closeUsageMeteringPool();
      await vi.advanceTimersByTimeAsync(25);
      await expect(appendDurableUsage(event)).rejects.toThrow("closed");
      expect(globalThis.__atlasUsagePgPool).toBeUndefined();
      expect(db.connect).toHaveBeenCalledOnce();
    } finally {
      await closeUsageMeteringPool();
      globalThis.__atlasUsagePgPool = previousPool;
      globalThis.__atlasUsageMeteringClosed = previousClosed;
    }
  });
  it("persists a same-tenant batch in one RLS transaction and rejects mixed tenants before checkout", async () => {
    const db = connection();
    const append = createDurableUsageBatchAppender(db.pool);
    const second = { ...event, id: "018f0000-0000-7000-8000-000000000003" };
    await append([event, second]);
    expect(db.connect).toHaveBeenCalledOnce();
    expect(db.query).toHaveBeenCalledTimes(5);
    expect(db.query.mock.calls[1]?.[0]).toBe("SET LOCAL ROLE atlas_app");
    expect(db.query.mock.calls[2]?.[1]).toEqual([event.tenantId, event.id]);
    const insert = db.query.mock.calls[3];
    if (!insert) throw new Error("Expected the durable batch insert");
    expect(insert[0]).toContain("unnest");
    expect(insert[0]).toContain("ON CONFLICT (id) DO NOTHING");
    expect(insert[1]).toEqual([
      [event.id, second.id],
      event.tenantId,
      ["2026-09-01", "2026-09-01"],
      [1, 1],
      [12.5, 12.5],
      [0, 0],
    ]);
    await expect(append([event, { ...second, tenantId: "another-tenant" }])).rejects.toThrow(
      "same tenant",
    );
    expect(db.connect).toHaveBeenCalledOnce();
  });
  it("emits optional usage-pool metrics and stops emission on shutdown", async () => {
    vi.useFakeTimers();
    vi.stubEnv("DATABASE_POOL_METRICS", "1");
    const output = vi.spyOn(console, "info").mockImplementation(() => {});
    const previousPool = globalThis.__atlasUsagePgPool;
    const previousClosed = globalThis.__atlasUsageMeteringClosed;
    const db = connection();
    globalThis.__atlasUsagePgPool = db.pool;
    try {
      const pending = appendDurableUsage(event);
      await vi.advanceTimersByTimeAsync(5);
      await pending;
      await vi.advanceTimersByTimeAsync(60_000);
      expect(output).toHaveBeenCalledTimes(2);
      const snapshot = JSON.parse(output.mock.calls[0]?.[0] as string);
      expect(snapshot).toMatchObject({
        event: "db_pool_metrics",
        pool: "usage",
        acquisition: { count: 1, errors: 0 },
        query: { count: 5, errors: 0 },
      });
      expect(JSON.stringify(snapshot)).not.toContain(event.tenantId);
      expect(JSON.parse(output.mock.calls[1]?.[0] as string)).toMatchObject({
        event: "usage_meter_metrics",
        acknowledgedEvents: 1,
        acknowledgedRequests: 1,
        retainedEvents: 0,
        failedBatchAttempts: 0,
      });
      await closeUsageMeteringPool();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(output).toHaveBeenCalledTimes(3);
    } finally {
      await closeUsageMeteringPool();
      globalThis.__atlasUsagePgPool = previousPool;
      globalThis.__atlasUsageMeteringClosed = previousClosed;
    }
  });

  it("waits for commit and uses only the supplied pool with transaction-local tenant context", async () => {
    const db = connection();
    await createDurableUsageAppender(db.pool)(event);
    const statements = db.query.mock.calls.map(([sql]) => sql);
    expect(statements[0]).toBe("BEGIN");
    expect(statements[1]).toBe("SET LOCAL ROLE atlas_app");
    expect(statements[2]).toContain("set_config('app.tenant_id', $1, true)");
    expect(db.query.mock.calls[2]?.[1]).toEqual([event.tenantId, event.id]);
    expect(statements[3]).toContain("ON CONFLICT (id) DO NOTHING");
    expect(db.query.mock.calls[3]?.[1]).toEqual([
      [event.id],
      event.tenantId,
      ["2026-09-01"],
      [event.requests],
      [event.durationMs],
      [event.emails],
    ]);
    expect(statements.at(-1)).toBe("COMMIT");
    expect(db.connect).toHaveBeenCalledOnce();
    expect(db.release).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("discards a failed transaction and never commits it", async () => {
    const db = connection({ failInsert: true });
    await expect(createDurableUsageAppender(db.pool)(event)).rejects.toThrow("insert failed");
    expect(db.query.mock.calls.some(([sql]) => sql === "COMMIT")).toBe(false);
    expect(db.release).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("destroys the live connection at the total deadline and awaits its query rejection", async () => {
    vi.useFakeTimers();
    const db = connection({ delayMs: 400 });
    const pending = createDurableUsageAppender(db.pool)(event);
    const failed = expect(pending).rejects.toThrow("deadline");
    await vi.advanceTimersByTimeAsync(USAGE_TRANSACTION_TIMEOUT_MS);
    await failed;
    expect(db.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(db.query.mock.calls.some(([sql]) => sql === "COMMIT")).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(db.release).toHaveBeenCalledOnce();
    expect(db.query).toHaveBeenCalledTimes(4);
  });

  it("caps the dedicated pool and acquisition budget independently of the shared pool", () => {
    expect(resolveUsagePoolMax(undefined)).toBe(2);
    expect(resolveUsagePoolMax("3")).toBe(3);
    expect(resolveUsagePoolMax("100")).toBe(8);
    for (const value of ["0", "-1", "NaN", "Infinity", "1.5", "2junk"])
      expect(resolveUsagePoolMax(value)).toBe(2);
    expect(USAGE_ACQUIRE_TIMEOUT_MS).toBeLessThanOrEqual(1000);
    expect(USAGE_TRANSACTION_TIMEOUT_MS).toBeLessThanOrEqual(2000);
  });
});
