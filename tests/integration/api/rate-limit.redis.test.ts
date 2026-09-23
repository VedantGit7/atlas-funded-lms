import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  RedisRateLimitStore,
  setRateLimitStore,
  type RateLimitRedisClient,
} from "@atlas/api/rate-limit-store";
import { enforcePublicRateLimit } from "@atlas/api/rate-limit";

const redisUrl = process.env["F04_TEST_REDIS_URL"];
type Client = RateLimitRedisClient & {
  connect(): Promise<void>;
  on(event: string, listener: () => void): void;
};
const Redis = createRequire(new URL("../../../backend/packages/api/package.json", import.meta.url))(
  "ioredis",
) as new (url: string, options: object) => Client;

describe.skipIf(!redisUrl)("F04 isolated real Redis", () => {
  let first: Client;
  let second: Client;
  let a: RedisRateLimitStore;
  let b: RedisRateLimitStore;
  beforeAll(async () => {
    if (!redisUrl) throw new Error("F04_TEST_REDIS_URL is required for this integration suite");
    const endpoint = new URL(redisUrl);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname))
      throw new Error("F04 Redis verification requires a local test instance");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("RATE_LIMIT_REDIS_URL", "");
    const prefix = `atlas:f04:test:${randomUUID()}:`;
    first = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    second = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    first.on("error", () => {});
    second.on("error", () => {});
    await Promise.all([first.connect(), second.connect()]);
    a = new RedisRateLimitStore(first, { prefix });
    b = new RedisRateLimitStore(second, { prefix });
  });
  afterAll(async () => {
    setRateLimitStore(null);
    vi.unstubAllEnvs();
    await Promise.allSettled([first?.quit(), second?.quit()]);
    // Unique test keys expire naturally; never flush a shared database.
  });
  it("atomically shares 100 concurrent increments across two connections", async () => {
    const hits = await Promise.all(
      Array.from({ length: 100 }, (_, index) => (index % 2 ? a : b).hit("concurrent", 60000)),
    );
    expect(hits.map((hit) => hit.count).sort((x, y) => x - y)).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1),
    );
    expect(hits.every((hit) => hit.resetAt > Date.now())).toBe(true);
  });
  it("preserves the public quota across application store instances", async () => {
    const args = {
      req: new Request("https://example.test/login", {
        headers: { "x-forwarded-for": "198.51.100.19" },
      }),
      bucket: "publicAuth" as const,
      requestId: "redis-f04",
    };
    setRateLimitStore(a);
    for (let index = 0; index < 10; index++) await enforcePublicRateLimit(args);
    setRateLimitStore(b);
    for (let index = 0; index < 10; index++) await enforcePublicRateLimit(args);
    await expect(enforcePublicRateLimit(args)).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: expect.any(Number),
    });
  });
  it("expires counters and starts a fresh window", async () => {
    expect((await a.hit("expiry", 100)).count).toBe(1);
    expect((await b.hit("expiry", 100)).count).toBe(2);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect((await b.hit("expiry", 100)).count).toBe(1);
  });
});
