import type { Pool } from "pg";

const bounds = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000] as const;
type Method = (this: unknown, ...args: unknown[]) => unknown;
type QueryClient = { query: Method };

function timing() {
  return {
    count: 0,
    errors: 0,
    totalMs: 0,
    maxMs: 0,
    inFlight: 0,
    buckets: [...bounds, null].map((upperBoundMs) => ({ upperBoundMs, count: 0 })),
  };
}

export interface PoolInstrumentationOptions {
  enabled: boolean;
  poolName: "tenant" | "platform" | "usage";
  emit?: (snapshot: PoolSnapshot) => void;
  now?: () => number;
}

export interface PoolSnapshot {
  event: "db_pool_metrics";
  capturedAt: string;
  pool: "tenant" | "platform" | "usage";
  pid: number;
  uptimeMs: number;
  acquisition: ReturnType<typeof timing>;
  query: ReturnType<typeof timing>;
  connections: { total: number; idle: number; waiting: number };
}

export interface PoolInstrumentation {
  snapshot(): PoolSnapshot;
  stop(): void;
}

const installed = new WeakMap<Pool, PoolInstrumentation>();

/** pg uses a 32-bit timer. Invalid configuration falls back to a finite 10s wait. */
export function connectionTimeoutMillis(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647 ? parsed : 10_000;
}

/**
 * Cumulative process-local aggregates, emitted every 60s only when opted in.
 * Query timing starts after checkout and includes the client's query queue.
 * SQL, parameters, results, URLs and error objects never enter a measurement.
 * Only promise/callback queries are instrumented; custom Query/stream objects
 * pass through unchanged. Their protocol and error-listener semantics differ.
 */
export function instrumentPool(
  pool: Pool,
  options: PoolInstrumentationOptions,
): PoolInstrumentation | undefined {
  if (!options.enabled) return undefined;
  const existing = installed.get(pool);
  if (existing) return existing;

  const now = options.now ?? (() => performance.now());
  const started = now();
  const acquisition = timing();
  const query = timing();
  const clients = new WeakSet();

  function begin(aggregate: ReturnType<typeof timing>) {
    const start = now();
    aggregate.inFlight++;
    let done = false;
    return (failed: boolean) => {
      if (done) return;
      done = true;
      const elapsed = Math.max(0, now() - start);
      aggregate.inFlight--;
      aggregate.count++;
      if (failed) aggregate.errors++;
      aggregate.totalMs += elapsed;
      aggregate.maxMs = Math.max(aggregate.maxMs, elapsed);
      const bucket = aggregate.buckets.find(
        (item) => item.upperBoundMs === null || elapsed <= item.upperBoundMs,
      );
      if (bucket) bucket.count++;
    };
  }

  function wrap(
    original: Method,
    aggregate: ReturnType<typeof timing>,
    onSuccess?: (value: unknown) => void,
  ): Method {
    return function (...args: unknown[]) {
      const config = args[0];
      // Preserve custom Query/stream identities and their event/error handling.
      if (aggregate === query && config && typeof config === "object" && "submit" in config) {
        return Reflect.apply(original, this, args);
      }
      const finish = begin(aggregate);
      const last = args.at(-1);
      let callback: Method | undefined;
      if (typeof last === "function") callback = last as Method;
      else if (
        aggregate === query &&
        config &&
        typeof config === "object" &&
        "callback" in config &&
        typeof config.callback === "function"
      )
        callback = config.callback as Method;
      if (callback) {
        const wrapped: Method = function (...values) {
          finish(Boolean(values[0]));
          if (!values[0]) onSuccess?.(values[1]);
          return Reflect.apply(callback, this, values);
        };
        if (typeof last === "function") args[args.length - 1] = wrapped;
        else args[0] = { ...(config as object), callback: wrapped };
      }
      try {
        const result = Reflect.apply(original, this, args);
        if (
          !callback &&
          result &&
          typeof result === "object" &&
          "then" in result &&
          typeof result.then === "function"
        ) {
          return (result as Promise<unknown>).then(
            (value) => {
              finish(false);
              onSuccess?.(value);
              return value;
            },
            (error: unknown) => {
              finish(true);
              throw error;
            },
          );
        }
        return result;
      } catch (error) {
        finish(true);
        throw error;
      }
    };
  }

  function instrumentClient(value: unknown) {
    const client = value as QueryClient | undefined;
    if (!client || clients.has(client)) return;
    clients.add(client);
    client.query = wrap(client.query, query);
  }

  // pool.query internally calls connect, so wrapping checked-out clients covers
  // both pool.query and Prisma's transaction clients without double counting.
  pool.connect = wrap(pool.connect.bind(pool), acquisition, instrumentClient) as Pool["connect"];

  const snapshot = (): PoolSnapshot => ({
    event: "db_pool_metrics",
    capturedAt: new Date().toISOString(),
    pool: options.poolName,
    pid: process.pid,
    uptimeMs: Math.max(0, now() - started),
    acquisition: { ...acquisition, buckets: acquisition.buckets.map((bucket) => ({ ...bucket })) },
    query: { ...query, buckets: query.buckets.map((bucket) => ({ ...bucket })) },
    connections: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
  });
  const emit =
    options.emit ??
    ((value: PoolSnapshot) => {
      console.info(JSON.stringify(value));
    });
  const timer = setInterval(() => {
    try {
      emit(snapshot());
    } catch {
      /* Observability must not break database work. */
    }
  }, 60_000);
  timer.unref();
  const stop = () => {
    clearInterval(timer);
  };
  // pg Pool.end() does not emit an "end" event. Preserve both end overloads.
  const originalEnd = pool.end.bind(pool);
  pool.end = function (...args: unknown[]) {
    stop();
    const result: unknown = Reflect.apply(originalEnd, pool, args);
    return result;
  } as Pool["end"];
  const controller = { snapshot, stop };
  installed.set(pool, controller);
  return controller;
}
