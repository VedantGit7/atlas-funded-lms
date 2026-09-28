import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  platform: vi.fn(),
  handler: vi.fn(),
  hit: vi.fn(),
  membership: vi.fn(),
}));
vi.mock("@atlas/auth", () => ({
  requireSupabaseUser: mocks.user,
  upsertAuthPrincipal: async () => ({ id: "principal-a" }),
}));
vi.mock("@atlas/auth/platform-auth", () => ({ requirePlatformPrincipal: mocks.platform }));
vi.mock("@atlas/db/global-db", () => ({ withGlobalDb: (fn: (db: object) => unknown) => fn({}) }));
vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (_ctx: unknown, fn: (tx: object) => unknown) => fn({}),
}));
vi.mock("@atlas/db", () => ({
  PlatformScopeError: class extends Error {},
  withPlatformScope: (_ctx: unknown, _reason: string, fn: (tx: object) => unknown) => fn({}),
}));
vi.mock("@atlas/membership", () => ({ requireActiveMembership: mocks.membership }));
vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRequest: async () => ({ tenantId: "tenant-a", host: "tenant.example.test" }),
}));
vi.mock("@atlas/authorization", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  can: async () => ({ allowed: true }),
  enforceEntitlement: async () => {},
  consumeEntitlementUnits: async () => {},
}));
vi.mock("../../../backend/packages/api/src/load-resource-ref", () => ({
  loadResourceRefOrDefault: async () => ({
    type: "tenant",
    id: "tenant-a",
    tenantId: "tenant-a",
    tenantScoped: true,
  }),
}));
vi.mock("../../../backend/packages/api/src/tenant-usage-meter", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  recordTenantUsage: vi.fn(),
}));
import { createTenantRoute } from "@atlas/api/create-tenant-route";
import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { setRateLimitStore } from "@atlas/api/rate-limit-store";

function request() {
  return new NextRequest("https://tenant.example.test/api/v1/action", {
    method: "POST",
    headers: {
      host: "tenant.example.test",
      origin: "https://tenant.example.test",
      "x-forwarded-for": "198.51.100.9",
      "content-type": "application/json",
      "x-atlas-platform-reason": "Test rate limiter enforcement",
    },
    body: "{}",
  });
}
function route(plane: "tenant" | "platform", bucket?: string) {
  const common = {
    body: z.object({}),
    output: z.object({ ok: z.boolean() }),
    handler: mocks.handler,
  };
  if (plane === "platform")
    return createPlatformRoute({
      ...common,
      metadata: {
        permission: "platform.tenant.manage",
        audit: "required",
        idempotency: "none",
        rateLimit: bucket ?? "platformMutation",
        reasonRequired: true,
      },
    });
  return createTenantRoute({
    ...common,
    metadata: {
      permission: "role.delete",
      audit: "required",
      idempotency: "none",
      rateLimit: bucket ?? "tenantMutation",
    },
  });
}
beforeEach(() => {
  vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
  vi.resetAllMocks();
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("REDIS_URL", "");
  vi.stubEnv("RATE_LIMIT_REDIS_URL", "");
  mocks.user.mockResolvedValue({
    supabaseUserId: "user-a",
    email: "a@example.test",
    mfaEnabled: true,
    sessionAssuranceLevel: "aal2",
  });
  mocks.platform.mockResolvedValue({
    platformPrincipalId: "operator-a",
    platformPermissions: ["platform.tenant.manage"],
  });
  mocks.membership.mockResolvedValue({ membershipId: "member-a" });
  mocks.handler.mockResolvedValue({ ok: true });
  mocks.hit.mockResolvedValue({ count: 1, resetAt: Date.now() + 60000 });
  setRateLimitStore({
    kind: "redis",
    hit: mocks.hit,
    reset: async () => {},
    close: async () => {},
  });
});
afterEach(() => {
  setRateLimitStore(null);
  vi.unstubAllEnvs();
});
describe("F04 protected HTTP boundaries", () => {
  it.each(["tenant", "platform"] as const)(
    "keeps unattributed %s internal calls under actor quotas",
    async (plane) => {
      const req = request();
      req.headers.delete("x-forwarded-for");
      mocks.hit.mockImplementation(async (key: string) => ({
        count: key.startsWith(`${plane}:operation:`) ? 61 : 1,
        resetAt: Date.now() + 60000,
      }));
      const response = await route(plane)(req);
      expect(response.status).toBe(429);
      expect(mocks.hit.mock.calls.every(([key]) => !String(key).startsWith("ingress:"))).toBe(true);
      expect(plane === "tenant" ? mocks.user : mocks.platform).toHaveBeenCalledOnce();
      expect(mocks.handler).not.toHaveBeenCalled();
    },
  );
  it.each(["tenant", "platform"] as const)(
    "limits %s ingress before authentication",
    async (plane) => {
      mocks.hit.mockResolvedValue({ count: 999999, resetAt: Date.now() + 60000 });
      const response = await route(plane)(request());
      expect(response.status).toBe(429);
      expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
      expect(mocks.user).not.toHaveBeenCalled();
      expect(mocks.platform).not.toHaveBeenCalled();
      expect(mocks.handler).not.toHaveBeenCalled();
    },
  );
  it.each(["tenant", "platform"] as const)(
    "enforces %s operation limits after resolving identity",
    async (plane) => {
      mocks.hit.mockImplementation(async (key: string) => ({
        count: key.startsWith(`${plane}:operation:`) ? 61 : 1,
        resetAt: Date.now() + 60000,
      }));
      const response = await route(plane)(request());
      expect(response.status).toBe(429);
      expect(mocks.handler).not.toHaveBeenCalled();
      expect(plane === "tenant" ? mocks.user : mocks.platform).toHaveBeenCalledOnce();
    },
  );
  it.each(["tenant", "platform"] as const)(
    "returns retryable 503 on %s limiter outage",
    async (plane) => {
      mocks.hit.mockRejectedValue(new Error("Redis unavailable"));
      const response = await route(plane)(request());
      expect(response.status).toBe(503);
      expect(response.headers.get("retry-after")).toBe("5");
      expect(mocks.handler).not.toHaveBeenCalled();
    },
  );
  it.each(["tenant", "platform"] as const)("rejects an unknown %s rate bucket", async (plane) => {
    const response = await route(plane, "unconfigured-bucket")(request());
    expect(response.status).toBe(500);
    expect(mocks.handler).not.toHaveBeenCalled();
  });
});
