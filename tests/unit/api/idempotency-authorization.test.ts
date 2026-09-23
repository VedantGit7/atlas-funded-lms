import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { AtlasHttpError } from "@atlas/core/http/errors";

const state = vi.hoisted(() => ({
  actor: "member-a",
  aal: "aal2",
  membershipActive: true,
  record: null as Record<string, unknown> | null,
  can: vi.fn(),
  entitlement: vi.fn(),
  consume: vi.fn(),
  resource: vi.fn(),
  handler: vi.fn(),
  query: vi.fn(),
}));
vi.mock("@atlas/auth", () => ({
  requireSupabaseUser: async () => ({
    supabaseUserId: "user-a",
    email: "a@example.test",
    mfaEnabled: true,
    sessionAssuranceLevel: state.aal,
  }),
  upsertAuthPrincipal: async () => ({ id: "principal-a" }),
}));
vi.mock("@atlas/db/global-db", () => ({ withGlobalDb: (fn: (db: object) => unknown) => fn({}) }));
vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (_ctx: unknown, fn: (tx: object) => unknown) =>
    fn({
      $queryRaw: state.query,
      $executeRaw: async (_sql: unknown, ...values: unknown[]) => {
        if (state.record)
          Object.assign(state.record, {
            status: "COMPLETED",
            response_json: JSON.parse(values[0] as string),
            response_omitted: values[1],
          });
        return 1;
      },
    }),
}));
vi.mock("@atlas/membership", () => ({
  requireActiveMembership: async () => {
    if (!state.membershipActive)
      throw new AtlasHttpError({
        code: "PERMISSION_DENIED",
        status: 403,
        message: "Inactive membership",
      });
    return { membershipId: state.actor };
  },
}));
vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRequest: async () => ({ tenantId: "tenant-a", host: "tenant.example.test" }),
}));
vi.mock("@atlas/authorization", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  can: state.can,
  enforceEntitlement: state.entitlement,
  consumeEntitlementUnits: state.consume,
}));
vi.mock("../../../backend/packages/api/src/load-resource-ref", () => ({
  loadResourceRefOrDefault: state.resource,
}));
vi.mock("../../../backend/packages/api/src/tenant-usage-meter", () => ({
  recordTenantUsage: vi.fn(),
}));
import { createTenantRoute } from "@atlas/api/create-tenant-route";

function route() {
  return createTenantRoute({
    metadata: {
      permission: "role.delete",
      audit: "required",
      rateLimit: "authenticatedTenantWrite",
      mfa: "required",
      idempotency: "required",
      entitlement: "feature.enabled",
      entitlementUsage: () => 1,
    },
    body: z.object({}),
    output: z.object({ result: z.string() }),
    handler: state.handler,
  });
}
function request() {
  return new NextRequest("https://tenant.example.test/api/v1/action", {
    method: "POST",
    headers: {
      origin: "https://tenant.example.test",
      "content-type": "application/json",
      "idempotency-key": "same-key",
    },
    body: "{}",
  });
}
const forbidden = () =>
  new AtlasHttpError({ code: "PERMISSION_DENIED", status: 403, message: "Access revoked" });

describe("F03 current authorization on actual tenant-wrapper retries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.actor = "member-a";
    state.aal = "aal2";
    state.membershipActive = true;
    state.record = null;
    state.query.mockImplementation(async (sql: TemplateStringsArray, ...values: unknown[]) => {
      if (sql.join("").includes("INSERT INTO")) {
        if (state.record) return [];
        state.record = {
          id: "record-a",
          status: "IN_PROGRESS",
          scope: values[2],
          actor_membership_id: values[3],
          request_fingerprint: values[5],
          replay_valid: true,
        };
        return [{ id: "record-a" }];
      }
      return state.record ? [state.record] : [];
    });
    state.can.mockResolvedValue({ allowed: true });
    state.entitlement.mockResolvedValue(undefined);
    state.consume.mockResolvedValue(undefined);
    state.resource.mockResolvedValue({
      type: "tenant",
      id: "tenant-a",
      tenantId: "tenant-a",
      tenantScoped: true,
    });
    state.handler.mockResolvedValue({ result: "private operation result" });
  });

  it.each(["permission", "resource", "entitlement", "membership", "MFA", "actor"])(
    "denies replay after %s changes",
    async (change) => {
      const run = route();
      expect((await run(request())).status).toBe(200);
      if (change === "permission")
        state.can.mockResolvedValue({
          allowed: false,
          permission: "role.delete",
          reason: "ROLE_PERMISSION_MISSING",
          matchedRoleKeys: [],
        });
      if (change === "resource") state.resource.mockRejectedValue(forbidden());
      if (change === "entitlement") state.entitlement.mockRejectedValue(forbidden());
      if (change === "membership") state.membershipActive = false;
      if (change === "MFA") state.aal = "aal1";
      if (change === "actor") state.actor = "member-b";
      const retry = await run(request());
      expect(retry.status).toBe(change === "actor" ? 422 : 403);
      expect(await retry.text()).not.toContain("private operation result");
      expect(state.handler).toHaveBeenCalledOnce();
      expect(state.consume).toHaveBeenCalledOnce();
    },
  );

  it("rechecks access but charges and mutates only once for an authorized retry", async () => {
    const run = route();
    const first = await run(request());
    const retry = await run(request());
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(await first.json());
    expect(state.can).toHaveBeenCalledTimes(2);
    expect(state.entitlement).toHaveBeenCalledTimes(2);
    expect(state.resource).toHaveBeenCalledTimes(2);
    expect(state.consume).toHaveBeenCalledOnce();
    expect(state.handler).toHaveBeenCalledOnce();
  });
});
