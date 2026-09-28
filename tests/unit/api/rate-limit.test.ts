import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveClientIp } from "../../../backend/packages/api/src/client-ip";
import {
  MemoryRateLimitStore,
  RedisRateLimitStore,
  resolveRateLimitStore,
  setRateLimitStore,
  type RateLimitRedisClient,
  type RateLimitStore,
} from "../../../backend/packages/api/src/rate-limit-store";
import {
  enforcePublicRateLimit,
  resetRateLimitsForTests,
} from "../../../backend/packages/api/src/rate-limit";

/**
 * Regression tests for audit findings F2 (per-process rate limiting),
 * L4 (429 reported as INTERNAL_ERROR) and L5 (spoofable x-forwarded-for).
 */

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://tenant.example.com/api/v1/public/thing", { headers });
}

afterEach(async () => {
  await resetRateLimitsForTests(null);
  setRateLimitStore(null);
  vi.unstubAllEnvs();
});

/* ------------------------------------------------------------------ L5 */

describe("resolveClientIp — trusted proxy hops", () => {
  it("takes the last entry with a single trusted proxy", () => {
    const ip = resolveClientIp(request({ "x-forwarded-for": "203.0.113.9" }), {
      TRUSTED_PROXY_HOPS: "1",
    } as NodeJS.ProcessEnv);
    expect(ip).toBe("203.0.113.9");
  });

  it("ignores a client-injected prefix — the spoof that made the limiter useless", () => {
    // Attacker sends X-Forwarded-For: <random>; the proxy appends the real peer.
    const attacker = request({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" });
    const ip = resolveClientIp(attacker, { TRUSTED_PROXY_HOPS: "1" } as NodeJS.ProcessEnv);

    expect(ip).toBe("203.0.113.9");
    expect(ip).not.toBe("1.2.3.4");
  });

  it("a spoofing client cannot rotate its bucket key", () => {
    const env = { TRUSTED_PROXY_HOPS: "1" } as NodeJS.ProcessEnv;
    const keys = new Set(
      ["a", "b", "c", "d"].map((n) =>
        resolveClientIp(request({ "x-forwarded-for": `9.9.9.${n}, 203.0.113.9` }), env),
      ),
    );
    expect(keys).toEqual(new Set(["203.0.113.9"]));
  });

  it("counts from the right with two trusted proxies", () => {
    const ip = resolveClientIp(request({ "x-forwarded-for": "1.2.3.4, 203.0.113.9, 10.0.0.1" }), {
      TRUSTED_PROXY_HOPS: "2",
    } as NodeJS.ProcessEnv);
    expect(ip).toBe("203.0.113.9");
  });

  it("defaults to zero trusted hops", () => {
    expect(
      resolveClientIp(
        request({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }),
        {} as NodeJS.ProcessEnv,
      ),
    ).toBe("unknown");
  });

  it("distrusts a header shorter than the configured hop count", () => {
    expect(
      resolveClientIp(request({ "x-forwarded-for": "1.2.3.4" }), {
        TRUSTED_PROXY_HOPS: "2",
      } as NodeJS.ProcessEnv),
    ).toBe("unknown");
  });

  it("ignores forwarding headers entirely at zero hops", () => {
    expect(
      resolveClientIp(request({ "x-forwarded-for": "1.2.3.4" }), {
        TRUSTED_PROXY_HOPS: "0",
      } as NodeJS.ProcessEnv),
    ).toBe("unknown");
  });

  it("returns unknown when no forwarding header is present", () => {
    expect(resolveClientIp(request(), {} as NodeJS.ProcessEnv)).toBe("unknown");
  });

  it.each(["fe80::1%eth0", "198.51.100.1,", ",198.51.100.1"])(
    "treats malformed or scoped forwarding value %s as unknown",
    (value) => {
      expect(
        resolveClientIp(request({ "x-forwarded-for": value }), { TRUSTED_PROXY_HOPS: "1" }),
      ).toBe("unknown");
    },
  );

  it("prefers a configured trusted edge header", () => {
    const ip = resolveClientIp(
      request({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "1.2.3.4, 10.0.0.1" }),
      { TRUSTED_CLIENT_IP_HEADER: "cf-connecting-ip" } as NodeJS.ProcessEnv,
    );
    expect(ip).toBe("198.51.100.7");
  });

  it("rejects a multi-valued trusted edge header", () => {
    // A genuine edge sets exactly one value; a list means the client wrote it.
    expect(
      resolveClientIp(request({ "cf-connecting-ip": "1.2.3.4, 198.51.100.7" }), {
        TRUSTED_CLIENT_IP_HEADER: "cf-connecting-ip",
      } as NodeJS.ProcessEnv),
    ).toBe("unknown");
  });

  it("rejects a malformed hop count instead of guessing", () => {
    expect(() =>
      resolveClientIp(request(), { TRUSTED_PROXY_HOPS: "-1" } as NodeJS.ProcessEnv),
    ).toThrow(/non-negative integer/);
  });
});

/* ------------------------------------------------------------------ F2 */

describe("resolveRateLimitStore", () => {
  it.each(["production", "staging"])(
    "refuses to fall back to per-process counters when APP_ENV=%s",
    (appEnv) => {
      setRateLimitStore(null);
      expect(() => resolveRateLimitStore({ APP_ENV: appEnv } as NodeJS.ProcessEnv)).toThrow(
        /REDIS_URL/,
      );
    },
  );

  it("allows the in-memory store outside production", () => {
    setRateLimitStore(null);
    const store = resolveRateLimitStore({ APP_ENV: "development" } as NodeJS.ProcessEnv);
    expect(store.kind).toBe("memory");
  });

  it("builds a redis-backed store when a URL is configured", () => {
    setRateLimitStore(null);
    const store = resolveRateLimitStore({
      APP_ENV: "production",
      REDIS_URL: "redis://127.0.0.1:6379",
    } as NodeJS.ProcessEnv);

    expect(store.kind).toBe("redis");
    return store.close().catch(() => undefined);
  });
});

describe("MemoryRateLimitStore", () => {
  it("counts hits within a window and rolls over after it", async () => {
    const store = new MemoryRateLimitStore();
    expect((await store.hit("k", 50)).count).toBe(1);
    expect((await store.hit("k", 50)).count).toBe(2);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect((await store.hit("k", 50)).count).toBe(1);
  });
});

describe("RedisRateLimitStore", () => {
  it("keeps counters in the shared store, so instances share one limit", async () => {
    // One fake Redis standing in for the shared server; two stores standing in
    // for two app instances. Before F2 was fixed each instance had its own Map.
    let counter = 0;
    const client: RateLimitRedisClient = {
      eval: () => Promise.resolve([++counter, 60_000]),
      quit: () => Promise.resolve("OK"),
    };

    const instanceA = new RedisRateLimitStore(client);
    const instanceB = new RedisRateLimitStore(client);

    expect((await instanceA.hit("k", 60_000)).count).toBe(1);
    expect((await instanceB.hit("k", 60_000)).count).toBe(2);
    expect((await instanceA.hit("k", 60_000)).count).toBe(3);
  });

  it("namespaces keys so the Redis is shareable", async () => {
    const seen: unknown[][] = [];
    const client: RateLimitRedisClient = {
      eval: (_script, _n, ...args) => {
        seen.push(args);
        return Promise.resolve([1, 60_000]);
      },
      quit: () => Promise.resolve("OK"),
    };

    await new RedisRateLimitStore(client, { prefix: "p:" }).hit("publicAuth:1.2.3.4", 60_000);
    expect(seen[0]?.[0]).toBe("p:publicAuth:1.2.3.4");
  });

  it("derives resetAt from the TTL the server reports", async () => {
    const client: RateLimitRedisClient = {
      eval: () => Promise.resolve([5, 30_000]),
      quit: () => Promise.resolve("OK"),
    };

    const before = Date.now();
    const hit = await new RedisRateLimitStore(client).hit("k", 60_000);
    expect(hit.resetAt).toBeGreaterThanOrEqual(before + 29_000);
    expect(hit.resetAt).toBeLessThanOrEqual(Date.now() + 30_000);
  });
});

/* ---------------------------------------------------------- enforcement */

describe("enforcePublicRateLimit", () => {
  beforeEach(() => vi.stubEnv("TRUSTED_PROXY_HOPS", "1"));
  it("allows exactly the bucket maximum and then throws", async () => {
    setRateLimitStore(new MemoryRateLimitStore());
    const req = request({ "x-forwarded-for": "203.0.113.9" });

    // publicInvitationAccept: 10 per minute.
    for (let i = 0; i < 10; i += 1) {
      await enforcePublicRateLimit({ req, bucket: "publicInvitationAccept", requestId: "r" });
    }

    await expect(
      enforcePublicRateLimit({ req, bucket: "publicInvitationAccept", requestId: "r" }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("reports RATE_LIMITED, not INTERNAL_ERROR", async () => {
    setRateLimitStore(new MemoryRateLimitStore());
    const req = request({ "x-forwarded-for": "203.0.113.10" });

    for (let i = 0; i < 10; i += 1) {
      await enforcePublicRateLimit({ req, bucket: "publicDiagnostic", requestId: "r" });
    }

    await expect(
      enforcePublicRateLimit({ req, bucket: "publicDiagnostic", requestId: "r" }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("keeps separate buckets per client and per bucket name", async () => {
    setRateLimitStore(new MemoryRateLimitStore());

    for (let i = 0; i < 10; i += 1) {
      await enforcePublicRateLimit({
        req: request({ "x-forwarded-for": "203.0.113.11" }),
        bucket: "publicDiagnostic",
        requestId: "r",
      });
    }

    // Different client, same bucket: unaffected.
    await expect(
      enforcePublicRateLimit({
        req: request({ "x-forwarded-for": "203.0.113.12" }),
        bucket: "publicDiagnostic",
        requestId: "r",
      }),
    ).resolves.toBeUndefined();

    // Same client, different bucket: unaffected.
    await expect(
      enforcePublicRateLimit({
        req: request({ "x-forwarded-for": "203.0.113.11" }),
        bucket: "publicRead",
        requestId: "r",
      }),
    ).resolves.toBeUndefined();
  });

  it("fails closed instead of multiplying quotas when the shared store is down", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken: RateLimitStore = {
      kind: "redis",
      hit: () => Promise.reject(new Error("ECONNREFUSED")),
      reset: () => Promise.resolve(),
      close: () => Promise.resolve(),
    };
    setRateLimitStore(broken);
    const req = request({ "x-forwarded-for": "203.0.113.13" });

    await expect(
      enforcePublicRateLimit({ req, bucket: "publicDiagnostic", requestId: "r" }),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", status: 503, retryAfterSeconds: 5 });
    await expect(
      enforcePublicRateLimit({ req, bucket: "publicDiagnostic", requestId: "r" }),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", status: 503 });

    consoleError.mockRestore();
  });
});
