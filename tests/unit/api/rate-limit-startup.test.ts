import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateRateLimitConfiguration } from "@atlas/api/rate-limit-store";
import { resolveClientIp } from "@atlas/api/client-ip";
vi.mock("@sentry/nextjs", () => ({ captureRequestError: vi.fn() }));
import { register as backendRegister } from "../../../backend/apps/api/src/instrumentation";
import { register as frontendRegister } from "../../../frontend/apps/web/src/instrumentation";

beforeEach(() => {
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ENV", "");
  vi.stubEnv("REDIS_URL", "");
  vi.stubEnv("RATE_LIMIT_REDIS_URL", "");
});
afterEach(() => vi.unstubAllEnvs());
describe("F04 production startup prerequisites", () => {
  it.each([
    ["backend", backendRegister],
    ["frontend", frontendRegister],
  ] as const)("rejects %s startup without Redis", async (_name, register) => {
    await expect(register()).rejects.toThrow(/REDIS_URL/);
  });
  it("validates a TLS Redis deployment without opening a connection", () => {
    expect(
      validateRateLimitConfiguration({
        NODE_ENV: "production",
        REDIS_URL: "rediss://redis.example.test:6380",
      }),
    ).toMatchObject({ sharedRequired: true });
  });
  it.each(["1junk", "1.5", "-1"])("rejects ambiguous proxy hop setting %s", (hops) => {
    expect(() => validateRateLimitConfiguration({ TRUSTED_PROXY_HOPS: hops })).toThrow(
      /non-negative integer/,
    );
  });
  it("collapses malformed client IPs instead of issuing attacker-chosen buckets", () => {
    expect(
      resolveClientIp(
        new Request("https://example.test", {
          headers: { "x-forwarded-for": "client-chosen-key" },
        }),
        { TRUSTED_PROXY_HOPS: "1" },
      ),
    ).toBe("unknown");
  });
  it("normalizes equivalent IPv6 addresses to one identity", () => {
    const ip = (value: string) =>
      resolveClientIp(
        new Request("https://example.test", { headers: { "x-forwarded-for": value } }),
        { TRUSTED_PROXY_HOPS: "1" },
      );
    expect(ip("2001:db8::1")).toBe(ip("2001:0db8:0:0:0:0:0:1"));
  });
});
