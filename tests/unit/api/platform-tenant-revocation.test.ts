import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";

const fixture = vi.hoisted(() => {
  const state = { status: "ACTIVE" as "ACTIVE" | "SUSPENDED" | "REMOVED" | null, admin: false };
  const query = vi.fn(async (sql: TemplateStringsArray) => {
    const text = sql.join("").toLowerCase();
    if (text.includes("insert into memberships")) {
      state.status = "ACTIVE";
      return [{ id: "member-1" }];
    }
    if (text.includes("select exists"))
      return [
        { ok: text.includes("from memberships") ? state.status === "ACTIVE" && state.admin : true },
      ];
    if (text.includes("from auth_principals")) return [{ id: "principal-1" }];
    if (text.includes("from memberships"))
      return state.status
        ? [
            {
              id: "member-1",
              tenant_id: "tenant-1",
              auth_principal_id: "principal-1",
              status: state.status,
              invited_email_normalized: null,
            },
          ]
        : [];
    return [];
  });
  const tx = { $queryRaw: query, $executeRaw: vi.fn(async () => 1) };
  return {
    state,
    tx,
    query,
    elevate: vi.fn(async (_ctx: unknown, _reason: string, fn: (db: typeof tx) => unknown) =>
      fn(tx),
    ),
    assignRole: vi.fn(async () => {
      state.admin = true;
    }),
    handler: vi.fn(async () => ({ ok: true })),
  };
});

vi.mock("@atlas/auth", () => ({
  requireSupabaseUser: async () => ({
    supabaseUserId: "user-1",
    email: "operator@example.com",
    mfaEnabled: true,
    sessionAssuranceLevel: "aal2",
  }),
  upsertAuthPrincipal: async () => ({ id: "principal-1" }),
}));
vi.mock("@atlas/db", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withPlatformScope: fixture.elevate,
}));
vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (tx: typeof fixture.tx) => unknown) => fn(fixture.tx),
}));
vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (_ctx: unknown, fn: (tx: typeof fixture.tx) => unknown) => fn(fixture.tx),
}));
vi.mock("@atlas/access", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assignSystemRoleToMembership: fixture.assignRole,
}));
vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRequest: async () => ({ tenantId: "tenant-1", host: "tenant.example.com" }),
}));
vi.mock("@atlas/authorization", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  enforceEntitlement: vi.fn(),
  can: async () => ({
    allowed: fixture.state.admin,
    permission: "role.read",
    reason: fixture.state.admin ? "ALLOWED" : "NO_ROLE_PERMISSION",
    matchedRoleKeys: [],
    bypassedResourcePredicate: false,
  }),
}));
vi.mock("../../../backend/packages/api/src/tenant-usage-meter", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  recordTenantUsage: vi.fn(),
}));

import { createTenantRoute } from "@atlas/api/create-tenant-route";

const route = createTenantRoute({
  metadata: {
    permission: "role.read",
    audit: "none",
    rateLimit: "authenticatedTenantRead",
    idempotency: "none",
  },
  output: z.object({ ok: z.boolean() }),
  handler: fixture.handler,
});
const request = () => new NextRequest("https://tenant.example.com/api/v1/roles");

describe("tenant access cannot self-elevate from platform configuration (F02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PLATFORM_OPERATOR_ASSIGNMENTS", "operator@example.com=super_admin");
    fixture.state.status = "ACTIVE";
    fixture.state.admin = false;
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["SUSPENDED", "REMOVED"] as const)(
    "preserves a %s membership despite stale platform config",
    async (status) => {
      fixture.state.status = status;
      const response = await route(request());
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: { code: `MEMBERSHIP_${status}` } });
      expect(fixture.state.status).toBe(status);
      expect(fixture.elevate).not.toHaveBeenCalled();
      expect(fixture.handler).not.toHaveBeenCalled();
    },
  );

  it("does not recreate a removed tenant admin role", async () => {
    const response = await route(request());
    expect(response.status).toBe(403);
    expect(fixture.state.admin).toBe(false);
    expect(fixture.assignRole).not.toHaveBeenCalled();
    expect(fixture.handler).not.toHaveBeenCalled();
  });

  it("does not create a tenant-admin membership for an environment-listed operator", async () => {
    fixture.state.status = null;
    const response = await route(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "NO_MEMBERSHIP" } });
    expect(fixture.state.status).toBeNull();
    expect(fixture.elevate).not.toHaveBeenCalled();
  });

  it("preserves independently assigned active tenant permissions", async () => {
    fixture.state.admin = true;
    const response = await route(request());
    expect(response.status).toBe(200);
    expect(fixture.handler).toHaveBeenCalledOnce();
    expect(fixture.elevate).not.toHaveBeenCalled();
  });
});
