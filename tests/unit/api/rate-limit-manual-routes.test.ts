import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { setRateLimitStore } from "@atlas/api/rate-limit-store";

const hit = vi.fn();
beforeEach(() => {
  vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("REDIS_URL", "");
  vi.stubEnv("RATE_LIMIT_REDIS_URL", "");
  hit.mockReset();
  setRateLimitStore({ kind: "redis", hit, reset: async () => {}, close: async () => {} });
});
afterEach(() => {
  setRateLimitStore(null);
  vi.unstubAllEnvs();
});

const downloads = [
  () => import("../../../backend/apps/api/src/app/api/v1/certificates/[id]/download/route"),
  () =>
    import("../../../backend/apps/api/src/app/api/v1/certificates/[id]/wallet/apple/download/route"),
  () => import("../../../backend/apps/api/src/app/api/v1/modules/[id]/scorm-content/route"),
];
describe("F04 custom HTTP boundaries", () => {
  it.each(downloads.map((load, index) => ({ load, index })))(
    "limits malformed download $index before parameter parsing",
    async ({ load }) => {
      hit.mockResolvedValue({ count: 999999, resetAt: Date.now() + 60000 });
      const { GET } = await load();
      const response = await GET(
        new NextRequest("https://example.test/invalid", {
          headers: { "x-forwarded-for": "198.51.100.1" },
        }),
        { params: Promise.resolve({ id: "invalid" }) },
      );
      expect(response.status).toBe(429);
      expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    },
  );
  it.each([
    {
      name: "backend",
      load: () =>
        import("../../../backend/apps/api/src/app/api/v1/public/diagnostic/[anonId]/merge/route"),
    },
  ])("preserves $name diagnostic throttle and outage headers", async ({ load }) => {
    const { POST } = await load();
    const req = () =>
      new NextRequest("https://example.test/api/v1/public/diagnostic/invalid/merge", {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.2" },
      });
    hit.mockResolvedValue({ count: 999999, resetAt: Date.now() + 60000 });
    const limited = await POST(req());
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    hit.mockRejectedValue(new Error("offline"));
    const offline = await POST(req());
    expect(offline.status).toBe(503);
    expect(offline.headers.get("retry-after")).toBe("5");
  });
});
