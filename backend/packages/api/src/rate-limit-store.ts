import Redis from "ioredis";
import { validateClientIpConfiguration } from "./client-ip";
import { isDeployedRuntime } from "@atlas/core/config/runtime-environment";

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

export class RateLimitConfigurationError extends Error {}

export function validateRateLimitConfiguration(env: NodeJS.ProcessEnv = process.env): {
  url: string | null;
  sharedRequired: boolean;
} {
  validateClientIpConfiguration(env);
  const url = env["RATE_LIMIT_REDIS_URL"]?.trim() || env["REDIS_URL"]?.trim() || null;
  const sharedRequired = isDeployedRuntime(env);
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new RateLimitConfigurationError("Invalid Redis URL for rate limiting.");
    }
    if (!["redis:", "rediss:"].includes(parsed.protocol) || !parsed.hostname)
      throw new RateLimitConfigurationError(
        "Invalid Redis URL for rate limiting; use redis:// or rediss://.",
      );
  } else if (sharedRequired) {
    throw new RateLimitConfigurationError(
      "REDIS_URL (or RATE_LIMIT_REDIS_URL) is required in production and staging.",
    );
  }
  return { url, sharedRequired };
}

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
  /** Stateful clients must be ready before commands can run with offline queuing disabled. */
  readonly status?: string;
  once?(event: "ready" | "error" | "end", listener: () => void): unknown;
  off?(event: "ready" | "error" | "end", listener: () => void): unknown;
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
  private readiness: Promise<void> | null = null;

  constructor(
    private readonly client: RateLimitRedisClient,
    options: { prefix?: string } = {},
  ) {
    this.prefix = options.prefix ?? "atlas:rl:";
  }

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    await this.waitUntilReady();
    // Typed as unknown rather than [number, number]: this crosses a wire, and
    // a client that returns strings must not silently produce NaN comparisons.
    const result = await this.client.eval(HIT_SCRIPT, 1, `${this.prefix}${key}`, windowMs);
    if (!Array.isArray(result) || result.length !== 2)
      throw new Error("Invalid rate-limit counter response");

    const count = Number(result[0]);
    const ttlMs = Number(result[1]);

    if (
      !Number.isSafeInteger(count) ||
      count < 1 ||
      !Number.isSafeInteger(ttlMs) ||
      ttlMs < 0 ||
      ttlMs > windowMs
    )
      throw new Error("Invalid rate-limit counter response");
    return { count, resetAt: Date.now() + ttlMs };
  }

  private waitUntilReady(): Promise<void> {
    const client = this.client;
    // Stateless adapters implement their own connection handling.
    if (client.status === undefined || client.status === "ready") return Promise.resolve();
    if (this.readiness) return this.readiness;
    const unavailable = () => new Error("Redis rate-limit connection unavailable");
    const once = client.once?.bind(client);
    const off = client.off?.bind(client);
    if (client.status === "end" || !once || !off) return Promise.reject(unavailable());

    // Share a bounded wait, not an offline command queue. Every caller still
    // performs its own atomic EVAL after readiness; failures never admit a hit.
    this.readiness = new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        off("ready", ready);
        off("error", failed);
        off("end", failed);
      };
      const ready = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(unavailable());
      };
      const timer = setTimeout(failed, 2000);
      once("ready", ready);
      once("error", failed);
      once("end", failed);
    }).finally(() => {
      this.readiness = null;
    });
    return this.readiness;
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

  // Do not let asynchronous connection events print URL credentials. The
  // limiter reports command failures through a safe, throttled log event.
  client.on("error", () => {});
  return new RedisRateLimitStore(client);
}

export function resolveRateLimitStore(env: NodeJS.ProcessEnv = process.env): RateLimitStore {
  const { url, sharedRequired } = validateRateLimitConfiguration(env);
  if (activeStore) {
    if (sharedRequired && activeStore.kind !== "redis")
      throw new RateLimitConfigurationError("A shared Redis rate-limit store is required.");
    return activeStore;
  }

  if (url) {
    activeStore = createRedisStore(url);
    return activeStore;
  }

  activeStore = new MemoryRateLimitStore();
  return activeStore;
}
