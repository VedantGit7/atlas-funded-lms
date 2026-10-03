import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api/public-route";
import { enforcePublicRateLimit } from "@atlas/api/rate-limit";
import {
  MemoryRateLimitStore,
  RedisRateLimitStore,
  resolveRateLimitStore,
  setRateLimitStore,
} from "@atlas/api/rate-limit-store";

vi.mock("ioredis", () => ({
  default: class {
    on() {
      return this;
    }
    quit() {
      return Promise.resolve();
    }
  },
}));
function request() {
  return new NextRequest("https://example.test/api/v1/public/login", {
    headers: { "x-forwarded-for": "198.51.100.10" },
  });
}
beforeEach(() => {
  setRateLimitStore(null);
  vi.stubEnv("REDIS_URL", "");
  vi.stubEnv("RATE_LIMIT_REDIS_URL", "");
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("NODE_ENV", "test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  setRateLimitStore(null);
  vi.restoreAllMocks();
});

describe("F04 strict shared limiter configuration and failures", () => {
  it("does not treat missing production configuration as a recoverable outage", async () => {
    vi.stubEnv("APP_ENV", "production");
    await expect(
      enforcePublicRateLimit({ req: request(), bucket: "publicAuth", requestId: "r" }),
    ).rejects.toThrow(/REDIS_URL/);
  });
  it("uses NODE_ENV=production even if APP_ENV says development", () => {
    expect(() => resolveRateLimitStore({ NODE_ENV: "production", APP_ENV: "development" })).toThrow(
      /REDIS_URL/,
    );
  });
  it("does not let a cached development store bypass production validation", () => {
    resolveRateLimitStore({ APP_ENV: "development" });
    expect(() => resolveRateLimitStore({ APP_ENV: "production" })).toThrow(/REDIS_URL/);
  });
  it.each(["https://redis.example.test", "not-a-url", "redis://"])(
    "rejects invalid Redis URL %s",
    (url) => {
      expect(() => resolveRateLimitStore({ APP_ENV: "production", REDIS_URL: url })).toThrow(
        /Redis URL/,
      );
    },
  );
  it("returns 503 on Redis outage without serving a locally counted request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setRateLimitStore({
      kind: "redis",
      hit: async () => {
        throw new Error("secret-connection-details");
      },
      reset: async () => {},
      close: async () => {},
    });
    await expect(
      enforcePublicRateLimit({ req: request(), bucket: "publicAuth", requestId: "r" }),
    ).rejects.toMatchObject({ status: 503 });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "secret-connection-details",
    );
  });
  it.each(
    [["NaN", 60000], [-1, 60000], [1, -1], [1, "invalid"], [], null].map((reply) => ({ reply })),
  )("rejects malformed Redis reply $reply", async ({ reply }) => {
    const store = new RedisRateLimitStore({ eval: async () => reply, quit: async () => {} });
    await expect(store.hit("test", 60000)).rejects.toThrow();
  });
  it("sends Retry-After with public 429 responses", async () => {
    setRateLimitStore(new MemoryRateLimitStore());
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const route = createPublicRouteHandler(
      { public: true, permission: "pub", rateLimit: "publicAuth", idempotency: "none" },
      handler,
    );
    for (let i = 0; i < 20; i++) expect((await route(request())).status).toBe(200);
    const denied = await route(request());
    expect(denied.status).toBe(429);
    expect(Number(denied.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(handler).toHaveBeenCalledTimes(20);
  });
});
