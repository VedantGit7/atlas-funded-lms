import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";

const state = vi.hoisted(() => ({
  sequence: [] as string[],
  failInsert: false,
  failCommit: false,
  deny: false,
  replay: false,
  append: vi.fn(),
  committed: vi.fn(),
  fallback: vi.fn(),
}));
vi.mock("@atlas/auth", () => ({
  requireSupabaseUser: async () => ({ supabaseUserId: "user-a", email: "a@example.test" }),
  upsertAuthPrincipal: async () => ({ id: "principal-a" }),
}));
vi.mock("@atlas/db/global-db", () => ({ withGlobalDb: (fn: (db: object) => unknown) => fn({}) }));
vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: async (_ctx: unknown, fn: (tx: object) => unknown) => {
    state.sequence.push("begin");
    try {
      const result = await fn({});
      state.sequence.push("commit");
      if (state.failCommit) throw new Error("Commit acknowledgement lost");
      return result;
    } catch (error) {
      state.sequence.push("transaction-error");
      throw error;
    }
  },
}));
vi.mock("@atlas/membership", () => ({
  requireActiveMembership: async () => ({ membershipId: "member-a" }),
}));
vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRequest: async () => ({ tenantId: "tenant-a", host: "tenant.example.test" }),
}));
vi.mock("@atlas/authorization", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  can: async () => ({ allowed: !state.deny, reason: "ROLE_PERMISSION_MISSING" }),
  enforceEntitlement: async () => {},
  consumeEntitlementUnits: async () => {},
}));
vi.mock("../../../backend/packages/api/src/rate-limit", () => ({
  enforceIngressRateLimit: async () => {},
  enforceProtectedRateLimit: async () => {},
}));
vi.mock("../../../backend/packages/api/src/load-resource-ref", () => ({
  loadResourceRefOrDefault: async () => ({ type: "tenant", id: "tenant-a", tenantId: "tenant-a" }),
}));
vi.mock("../../../backend/packages/api/src/idempotency-registry", () => ({
  validateIdempotencyKey: () => {},
  fingerprintRequest: () => "fingerprint",
  withIdempotency: async (_tx: unknown, _args: unknown, fn: () => Promise<unknown>) =>
    state.replay ? { ok: true } : fn(),
}));
vi.mock("../../../backend/packages/api/src/tenant-usage-meter", () => ({
  recordTenantUsage: vi.fn(),
  createTenantRequestUsage: () => ({
    append: state.append,
    committed: state.committed,
    fallback: state.fallback,
  }),
}));
import { createTenantRoute } from "@atlas/api/create-tenant-route";

const request = () =>
  new NextRequest("https://tenant.example.test/api/v1/action", {
    method: "POST",
    headers: { origin: "https://tenant.example.test", "idempotency-key": "operation-key" },
    body: "{}",
  });
function route() {
  return createTenantRoute({
    metadata: { permission: "role.delete", audit: "required", idempotency: "required" },
    body: z.object({}),
    output: z.object({ ok: z.boolean() }),
    handler: async () => {
      state.sequence.push("business");
      return { ok: true };
    },
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  state.sequence = [];
  state.failInsert = false;
  state.failCommit = false;
  state.deny = false;
  state.replay = false;
  state.append.mockImplementation(async () => {
    state.sequence.push("journal");
    if (state.failInsert) throw new Error("Journal write failed");
  });
  state.committed.mockImplementation(() => {
    state.sequence.push("acknowledged");
  });
  state.fallback.mockResolvedValue(true);
});
describe("tenant request usage commits with its business transaction", () => {
  it("journals a successful handler before commit and acknowledges only afterward", async () => {
    expect((await route()(request())).status).toBe(200);
    expect(state.sequence).toEqual(["begin", "business", "journal", "commit", "acknowledged"]);
    expect(state.fallback).not.toHaveBeenCalled();
  });
  it("journals an authorized replay without running the business operation again", async () => {
    state.replay = true;
    expect((await route()(request())).status).toBe(200);
    expect(state.sequence).toEqual(["begin", "journal", "commit", "acknowledged"]);
  });
  it("does not commit business work or return success when the journal insert fails", async () => {
    state.failInsert = true;
    expect((await route()(request())).status).toBe(500);
    expect(state.sequence).toEqual(["begin", "business", "journal", "transaction-error"]);
    expect(state.committed).not.toHaveBeenCalled();
    expect(state.fallback).toHaveBeenCalledOnce();
  });
  it("uses the same request recorder for fallback after an uncertain commit", async () => {
    state.failCommit = true;
    expect((await route()(request())).status).toBe(500);
    expect(state.append).toHaveBeenCalledOnce();
    expect(state.committed).not.toHaveBeenCalled();
    expect(state.fallback).toHaveBeenCalledOnce();
  });
  it("keeps denied requests out of business work and sends their usage to fallback", async () => {
    state.deny = true;
    expect((await route()(request())).status).toBe(403);
    expect(state.sequence).not.toContain("business");
    expect(state.append).not.toHaveBeenCalled();
    expect(state.fallback).toHaveBeenCalledOnce();
  });
});
