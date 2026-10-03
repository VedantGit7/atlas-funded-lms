import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  principal: vi.fn(),
  operator: vi.fn(),
  membership: vi.fn(),
  can: vi.fn(),
  idempotency: vi.fn(),
  handler: vi.fn(),
}));

vi.mock("../../../backend/packages/auth/src/session", () => ({ requireSupabaseUser: mocks.user }));
vi.mock("../../../backend/packages/auth/src/auth-principal.repository", () => ({
  upsertAuthPrincipal: mocks.principal,
}));
vi.mock("../../../backend/packages/auth/src/platform-operators.repository", () => ({
  findActivePlatformOperator: mocks.operator,
}));
vi.mock("@atlas/db/global-db", () => ({ withGlobalDb: (fn: (db: object) => unknown) => fn({}) }));
vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (_ctx: unknown, fn: (tx: object) => unknown) => fn({}),
}));
vi.mock("@atlas/membership", () => ({
  requireActiveMembership: mocks.membership,
}));
vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRequest: async () => ({ tenantId: "tenant-1", host: "tenant.example.com" }),
}));
vi.mock("@atlas/authorization", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  can: mocks.can,
  enforceEntitlement: vi.fn(),
}));
vi.mock("../../../backend/packages/api/src/idempotency-registry", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withIdempotency: mocks.idempotency,
}));
vi.mock("../../../backend/packages/api/src/tenant-usage-meter", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  recordTenantUsage: vi.fn(),
}));
vi.mock("../../../backend/packages/api/src/load-resource-ref", () => ({
  loadResourceRefOrDefault: async () => ({
    type: "tenant",
    id: "tenant-1",
    tenantId: "tenant-1",
    tenantScoped: true,
  }),
}));

import { createTenantRoute } from "@atlas/api/create-tenant-route";
import { requirePlatformPrincipal } from "@atlas/auth/platform-auth";

function authenticatedSession(sessionAssuranceLevel: "aal1" | "aal2" | null | undefined) {
  return {
    supabaseUserId: "user-1",
    email: "operator@example.com",
    mfaEnabled: true,
    sessionAssuranceLevel,
  };
}

function request() {
  return new NextRequest("https://tenant.example.com/api/v1/sensitive-action", {
    method: "POST",
    headers: {
      origin: "https://tenant.example.com",
      "content-type": "application/json",
      "idempotency-key": "same-operation",
    },
    body: "{}",
  });
}

function tenantRoute(mfa: "required" | "none", idempotency: "required" | "none" = "none") {
  return createTenantRoute({
    metadata: {
      permission: "role.delete",
      audit: "required",
      rateLimit: "authenticatedTenantWrite",
      mfa,
      idempotency,
    },
    body: z.object({}).strict(),
    output: z.object({ result: z.string() }),
    handler: mocks.handler,
  });
}

describe("session MFA at platform and tenant boundaries (F01)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue(authenticatedSession("aal1"));
    mocks.principal.mockResolvedValue({ id: "principal-1", mfaEnabled: true });
    mocks.operator.mockResolvedValue({ roleKey: "super_admin" });
    mocks.membership.mockResolvedValue({ membershipId: "member-1" });
    mocks.can.mockResolvedValue({ allowed: true });
    mocks.handler.mockResolvedValue({ result: "executed" });
    mocks.idempotency.mockResolvedValue({ result: "cached" });
  });

  it.each(["aal1", null, undefined] as const)(
    "denies an enrolled platform operator at %s",
    async (level) => {
      mocks.user.mockResolvedValue(authenticatedSession(level));
      await expect(
        requirePlatformPrincipal({
          req: request(),
          db: { $queryRaw: vi.fn() },
          requiredPermission: "platform.tenant.read",
        }),
      ).rejects.toMatchObject({ code: "MFA_REQUIRED", status: 403 });
    },
  );

  it("allows a platform operator at AAL2", async () => {
    mocks.user.mockResolvedValue(authenticatedSession("aal2"));
    await expect(
      requirePlatformPrincipal({
        req: request(),
        db: { $queryRaw: vi.fn() },
        requiredPermission: "platform.tenant.read",
      }),
    ).resolves.toMatchObject({ platformPrincipalId: "principal-1" });
  });

  it.each(["aal1", null, undefined] as const)(
    "denies a sensitive tenant handler at %s despite enrollment",
    async (level) => {
      mocks.user.mockResolvedValue(authenticatedSession(level));
      const response = await tenantRoute("required")(request());
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: { code: "MFA_REQUIRED" } });
      expect(mocks.handler).not.toHaveBeenCalled();
    },
  );

  it("runs a sensitive tenant handler at AAL2", async () => {
    mocks.user.mockResolvedValue(authenticatedSession("aal2"));
    const response = await tenantRoute("required")(request());
    expect(response.status).toBe(200);
    expect(mocks.handler).toHaveBeenCalledOnce();
  });

  it("keeps non-MFA tenant operations available at AAL1", async () => {
    const response = await tenantRoute("none")(request());
    expect(response.status).toBe(200);
    expect(mocks.handler).toHaveBeenCalledOnce();
  });

  it("checks MFA before looking up a cached sensitive response", async () => {
    const response = await tenantRoute("required", "required")(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "MFA_REQUIRED" } });
    expect(mocks.idempotency).not.toHaveBeenCalled();
    expect(mocks.handler).not.toHaveBeenCalled();
  });

  it("allows an AAL2 session to receive its cached response without repeating the handler", async () => {
    mocks.user.mockResolvedValue(authenticatedSession("aal2"));
    const response = await tenantRoute("required", "required")(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: "cached" });
    expect(mocks.idempotency).toHaveBeenCalledOnce();
    expect(mocks.handler).not.toHaveBeenCalled();
  });
});
