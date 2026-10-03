import { EventEmitter } from "node:events";
import { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  instrumentPool,
  connectionTimeoutMillis,
} from "../../../backend/packages/db/src/pool-instrumentation";

type Callback = (...args: unknown[]) => void;
function fixture() {
  let time = 0;
  let queryError: Error | undefined;
  let connectError: Error | undefined;
  const release = vi.fn();
  const result = { rows: [{ secret: "private-result" }] };
  const client = {
    release,
    query(...args: unknown[]) {
      time += 7;
      if (args[0] === null) throw new Error("private-sync-error");
      const config = args[0] as { callback?: Callback };
      const callback =
        typeof args.at(-1) === "function" ? (args.at(-1) as Callback) : config.callback;
      if (callback) {
        callback(queryError, result);
        return undefined;
      }
      return queryError ? Promise.reject(queryError) : Promise.resolve(result);
    },
  };
  const pool = Object.assign(new EventEmitter(), {
    totalCount: 2,
    idleCount: 1,
    waitingCount: 0,
    end() {
      return Promise.resolve();
    },
    connect(callback?: Callback) {
      time += 3;
      if (callback) {
        callback(connectError, connectError ? undefined : client, release);
        return undefined;
      }
      return connectError ? Promise.reject(connectError) : Promise.resolve(client);
    },
  });
  const emit = vi.fn();
  const metrics = instrumentPool(pool as unknown as Pool, {
    enabled: true,
    poolName: "tenant",
    emit,
    now: () => time,
  });
  if (!metrics) throw new Error("Expected enabled metrics");
  return {
    pool,
    client,
    release,
    result,
    metrics,
    emit,
    queryFails: () => {
      queryError = new Error("SQL private-query secret-parameter");
      return queryError;
    },
    connectFails: () => {
      connectError = new Error("postgres://secret@private-host");
      return connectError;
    },
  };
}

afterEach(() => vi.useRealTimers());

describe("bounded pool instrumentation", () => {
  it("leaves methods and listeners untouched when disabled", () => {
    const pool = Object.assign(new EventEmitter(), { connect: vi.fn() });
    const original = pool.connect;
    expect(
      instrumentPool(pool as unknown as Pool, { enabled: false, poolName: "tenant" }),
    ).toBeUndefined();
    expect(pool.connect).toBe(original);
    expect(pool.eventNames()).toEqual([]);
  });

  it("measures promise acquisition and checked-out Prisma-style queries once", async () => {
    const f = fixture();
    const client = await f.pool.connect();
    if (!client) throw new Error("Expected checked-out client");
    expect(await client.query({ text: "private-sql", values: ["private-parameter"] })).toBe(
      f.result,
    );
    await f.pool.connect();
    await client.query("private-sql");
    const snapshot = f.metrics.snapshot();
    expect(snapshot.acquisition).toMatchObject({
      count: 2,
      errors: 0,
      totalMs: 6,
      maxMs: 3,
      inFlight: 0,
    });
    expect(snapshot.query).toMatchObject({
      count: 2,
      errors: 0,
      totalMs: 14,
      maxMs: 7,
      inFlight: 0,
    });
    expect(snapshot.connections).toEqual({ total: 2, idle: 1, waiting: 0 });
    expect(JSON.stringify(snapshot)).not.toMatch(/private|secret|sql|parameter/i);
    f.metrics.stop();
  });

  it("preserves callback return values, results, release and config callbacks", () => {
    const f = fixture();
    const callback = vi.fn();
    expect(
      f.pool.connect((error, client, release) => {
        expect(error).toBeUndefined();
        expect(client).toBe(f.client);
        expect(release).toBe(f.release);
        expect(f.client.query("private-sql", [], callback)).toBeUndefined();
      }),
    ).toBeUndefined();
    const config = { text: "private-sql", callback };
    f.client.query(config);
    expect(config.callback).toBe(callback);
    expect(callback).toHaveBeenCalledWith(undefined, f.result);
    expect(f.metrics.snapshot().query.count).toBe(2);
    f.metrics.stop();
  });

  it("preserves promise errors and aggregates failures without error text", async () => {
    const f = fixture();
    await f.pool.connect();
    const error = f.queryFails();
    await expect(f.client.query("private-sql")).rejects.toBe(error);
    const connectError = f.connectFails();
    await expect(f.pool.connect()).rejects.toBe(connectError);
    expect(f.metrics.snapshot().query.errors).toBe(1);
    expect(f.metrics.snapshot().acquisition.errors).toBe(1);
    expect(JSON.stringify(f.metrics.snapshot())).not.toMatch(/private|secret|postgres/);
    f.metrics.stop();
  });

  it("preserves callback failures and counts synchronous query failures once", async () => {
    const f = fixture();
    await f.pool.connect();
    const error = f.queryFails();
    const callback = vi.fn();
    f.client.query("private-sql", callback);
    expect(callback.mock.calls[0]?.[0]).toBe(error);
    expect(() => f.client.query(null)).toThrow("private-sync-error");
    const connectError = f.connectFails();
    f.pool.connect(callback);
    expect(callback.mock.calls[1]?.[0]).toBe(connectError);
    expect(f.metrics.snapshot().query).toMatchObject({ count: 2, errors: 2, inFlight: 0 });
    f.metrics.stop();
  });

  it("keeps storage fixed as query volume grows and emits aggregates on an unref timer", async () => {
    vi.useFakeTimers();
    const f = fixture();
    await f.pool.connect();
    for (let i = 0; i < 2000; i++) await f.client.query(`private-${i}`);
    const snapshot = f.metrics.snapshot();
    expect(snapshot.query.count).toBe(2000);
    expect(snapshot.query.buckets).toHaveLength(12);
    expect(snapshot.query.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(2000);
    expect(JSON.stringify(snapshot).length).toBeLessThan(2000);
    vi.advanceTimersByTime(60_000);
    expect(f.emit).toHaveBeenCalledTimes(1);
    await f.pool.end();
    vi.advanceTimersByTime(60_000);
    expect(f.emit).toHaveBeenCalledTimes(1);
  });

  it("does not let a broken metrics sink affect queries", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.emit.mockImplementation(() => {
      throw new Error("sink unavailable");
    });
    expect(() => vi.advanceTimersByTime(60_000)).not.toThrow();
    await f.pool.connect();
    expect(await f.client.query("private-sql")).toBe(f.result);
    f.metrics.stop();
  });

  it("covers actual pg pool.query delegation and stops emission on pool.end", async () => {
    vi.useFakeTimers();
    class LocalClient extends EventEmitter {
      _queryable = true;
      _ending = false;
      connect(callback: Callback) {
        callback();
      }
      query(_text: unknown, values: unknown, cb?: Callback) {
        const callback = typeof values === "function" ? (values as Callback) : cb;
        if (callback) {
          callback(undefined, { rows: [] });
          return undefined;
        }
        return Promise.resolve({ rows: [] });
      }
      end(callback?: Callback) {
        callback?.();
      }
    }
    const pool = new Pool({ Client: LocalClient } as unknown as ConstructorParameters<
      typeof Pool
    >[0]);
    const emit = vi.fn();
    const metrics = instrumentPool(pool, { enabled: true, poolName: "platform", emit });
    if (!metrics) throw new Error("Expected enabled metrics");
    expect(await pool.query("test-only")).toEqual({ rows: [] });
    await new Promise<void>((resolve, reject) =>
      pool.query("test-only", (error, result) => {
        if (error) reject(error);
        expect(result.rows).toEqual([]);
        resolve();
      }),
    );
    const client = await pool.connect();
    await client.query({ text: "test-only", values: [] });
    client.release();
    expect(metrics.snapshot().acquisition.count).toBe(3);
    expect(metrics.snapshot().query.count).toBe(3);
    await pool.end();
    emit.mockClear();
    vi.advanceTimersByTime(120_000);
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("finite acquisition timeout", () => {
  it.each([undefined, "", "0", "-1", "Infinity", "12abc", "1.5", "999999999999"])(
    "uses a finite default for invalid %s",
    (value) => {
      expect(connectionTimeoutMillis(value)).toBe(10_000);
    },
  );
  it("accepts a positive bounded integer override", () => {
    expect(connectionTimeoutMillis("2500")).toBe(2500);
  });
});
