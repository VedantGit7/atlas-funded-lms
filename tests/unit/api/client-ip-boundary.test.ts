import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApiProxyHeaders, sanitizeApiProxyHeaders } from "@atlas/core/http/api-proxy";
import {
  enforceIngressRateLimit,
  enforceProtectedRateLimit,
  enforcePublicRateLimit,
} from "@atlas/api/rate-limit";
import { setRateLimitStore } from "@atlas/api/rate-limit-store";

const hit = vi.fn(async (_key: string, _windowMs: number) => ({
  count: 1,
  resetAt: Date.now() + 60_000,
}));
function forwarded(source: "browser" | "server", ip = "unknown") {
  const headers = buildApiProxyHeaders("tenant.example.test", undefined, process.env, ip);
  headers.set("x-atlas-proxy-source", source);
  sanitizeApiProxyHeaders(headers);
  return new Request("https://api.example.test/api/v1/me", { headers });
}
beforeEach(() => {
  vi.stubEnv("APP_ENV", "staging");
  vi.stubEnv("RATE_LIMIT_REDIS_URL", "rediss://redis.example.test:6380");
  vi.stubEnv("API_PROXY_SECRET", "synthetic-proxy-key-long-enough-for-test");
  hit.mockClear();
  setRateLimitStore({ kind: "redis", hit, reset: async () => {}, close: async () => {} });
});
afterEach(() => {
  vi.unstubAllEnvs();
  setRateLimitStore(null);
});

describe("deployed client IP admission", () => {
  it("rejects unknown external callers without spending another tenant's quota", async () => {
    await expect(
      enforceIngressRateLimit({
        req: new Request("https://api.example.test"),
        plane: "tenant",
        requestId: "r",
      }),
    ).rejects.toMatchObject({ status: 503, retryAfterSeconds: 5 });
    expect(hit).not.toHaveBeenCalled();
  });
  it("rejects unknown browser rewrites even though web transport authenticated", async () => {
    await expect(
      enforceIngressRateLimit({ req: forwarded("browser"), plane: "tenant", requestId: "r" }),
    ).rejects.toMatchObject({ status: 503 });
    expect(hit).not.toHaveBeenCalled();
  });
  it("does not treat legacy authenticated forwarding without a source as internal SSR", async () => {
    const headers = new Headers({ "x-atlas-proxy-key": process.env["API_PROXY_SECRET"] ?? "" });
    sanitizeApiProxyHeaders(headers);
    await expect(
      enforceIngressRateLimit({
        req: new Request("https://api.example.test/api/v1/me", { headers }),
        plane: "tenant",
        requestId: "r",
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(hit).not.toHaveBeenCalled();
  });
  it("allows authenticated internal SSR without a global unknown bucket but enforces actor quotas", async () => {
    await enforceIngressRateLimit({ req: forwarded("server"), plane: "tenant", requestId: "r" });
    expect(hit).not.toHaveBeenCalled();
    await enforceProtectedRateLimit({
      plane: "tenant",
      tenantId: "t",
      actorId: "a",
      permission: "course.read",
      bucket: "tenantRead",
      requestId: "r",
    });
    expect(hit).toHaveBeenCalledTimes(3);
  });
  it.each(["browser", "server"] as const)(
    "rejects unknown public %s calls without sharing an unknown bucket",
    async (source) => {
      await expect(
        enforcePublicRateLimit({ req: forwarded(source), bucket: "publicAuth", requestId: "r" }),
      ).rejects.toMatchObject({ status: 503 });
      expect(hit).not.toHaveBeenCalled();
    },
  );
  it("keeps attributed users in separate public and ingress buckets", async () => {
    for (const ip of ["198.51.100.1", "198.51.100.2"]) {
      const req = forwarded("browser", ip);
      await enforceIngressRateLimit({ req, plane: "tenant", requestId: "r" });
      await enforcePublicRateLimit({ req, bucket: "publicAuth", requestId: "r" });
    }
    expect(new Set(hit.mock.calls.map((call) => call[0])).size).toBe(4);
  });
});
