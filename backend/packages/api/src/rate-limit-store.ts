import Redis from "ioredis";

/**
 * Rate-limit counter storage.
 *
 * Audit finding F2/H-tier: counters lived in a module-level `Map`, so the limit
 * was per-process, not per-platform. With N app instances the effective limit was
 * N x the configured value, and every deploy reset every counter to zero. The
 * deployment plan runs two instances at launch and autoscales from there, so the
 * limiter was already wrong on day one.
 *
 * The store is a seam rather than a hard Redis dependency: local development and
 * unit tests must not require a Redis, but production must not silently fall back
 * to a per-process map. `resolveRateLimitStore` therefore throws when a
 * production-like environment has no shared store configured.
 */

export type RateLimitHit = {
  /** Number of requests recorded in the current window, including this one. */
  count: number;
  /** Epoch milliseconds at which the current window expires. */
  resetAt: number;
};

export type RateLimitStore = {
  readonly kind: "memory" | "redis";
  /** Atomically records one hit against `key` and returns the window state. */
  hit(key: string, windowMs: number): Promise<RateLimitHit>;
  reset(): Promise<void>;
  close(): Promise<void>;
};

const PRODUCTION_LIKE_ENVS = new Set(["production", "staging"]);

/* ------------------------------------------------------------------ memory */

/**
 * Per-process fallback. Correct for a single instance; deliberately unavailable
 * as the primary store in production.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  readonly kind = "memory" as const;

  private readonly entries = new Map<string, RateLimitHit>();
  /** Sweep counter — the old implementation never evicted, so the Map grew without bound. */
  private sinceSweep = 0;

  hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const now = Date.now();
    this.maybeSweep(now);

    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.entries.set(key, fresh);
      return Promise.resolve(fresh);
    }

    current.count += 1;
    return Promise.resolve(current);
  }

  private maybeSweep(now: number): void {
    this.sinceSweep += 1;
    if (this.sinceSweep < 1_000) return;
    this.sinceSweep = 0;

    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }

  reset(): Promise<void> {
    this.entries.clear();
    this.sinceSweep = 0;
    return Promise.resolve();
  }

  close(): Promise<void> {
    return this.reset();
  }
}

/* ------------------------------------------------------------------- redis */

/**
 * Minimal surface we need from a Redis client, so the store can be unit-tested
 * and so swapping `ioredis` for another client is a local change.
 */
export type RateLimitRedisClient = {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
  quit(): Promise<unknown>;
};

/**
 * INCR-then-PEXPIRE is not atomic across two round trips: a crash or a race
 * between them leaves a key with no TTL, which permanently locks that client out.
 * The Lua script makes the pair a single atomic server-side operation and returns
 * the remaining TTL so the caller can emit an accurate Retry-After.
 */
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

export class RedisRateLimitStore implements RateLimitStore {
  readonly kind = "redis" as const;

  private readonly prefix: string;

  constructor(
    private readonly client: RateLimitRedisClient,
    options: { prefix?: string } = {},
  ) {
    this.prefix = options.prefix ?? "atlas:rl:";
  }

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    // Typed as unknown rather than [number, number]: this crosses a wire, and
    // a client that returns strings must not silently produce NaN comparisons.
    const result = (await this.client.eval(
      HIT_SCRIPT,
      1,
      `${this.prefix}${key}`,
      windowMs,
    )) as unknown[];

    const count = Number(result[0]);
    const ttlMs = Number(result[1]);

    return { count, resetAt: Date.now() + (Number.isFinite(ttlMs) ? ttlMs : windowMs) };
  }

  /**
   * Not implemented: clearing shared counters would let one instance hand every
   * other instance's clients a fresh quota. Windows expire on their own.
   */
  reset(): Promise<void> {
    return Promise.resolve();
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

/* ---------------------------------------------------------------- resolver */

let activeStore: RateLimitStore | null = null;

export function setRateLimitStore(store: RateLimitStore | null): void {
  activeStore = store;
}

/**
 * The client is constructed only when a URL is configured, so importing this
 * module never opens a connection — local development and the test suite run
 * with no Redis at all.
 */
function createRedisStore(url: string): RateLimitStore {
  const client = new Redis(url, {
    // A rate limiter must never become the reason a request hangs.
    connectTimeout: 2_000,
    commandTimeout: 1_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
  });

  return new RedisRateLimitStore(client);
}

export function resolveRateLimitStore(env: NodeJS.ProcessEnv = process.env): RateLimitStore {
  if (activeStore) return activeStore;

  const url = env["RATE_LIMIT_REDIS_URL"]?.trim() || env["REDIS_URL"]?.trim();
  const appEnv = env["APP_ENV"] ?? "";

  if (url) {
    activeStore = createRedisStore(url);
    return activeStore;
  }

  // Fail loudly rather than shipping a limiter that multiplies by instance count.
  if (PRODUCTION_LIKE_ENVS.has(appEnv)) {
    throw new Error(
      `REDIS_URL (or RATE_LIMIT_REDIS_URL) must be set when APP_ENV=${appEnv}. ` +
        "Without a shared store the rate limiter counts per process, so the real " +
        "limit is multiplied by the instance count and resets on every deploy.",
    );
  }

  activeStore = new MemoryRateLimitStore();
  return activeStore;
}
