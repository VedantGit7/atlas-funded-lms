import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AtlasHttpError } from "@atlas/core/http/errors";

const state = vi.hoisted(() => ({
  globalDepth: 0,
  order: [] as string[],
  authDepths: [] as number[],
  tenantDepths: [] as number[],
  rateLimitDepths: [] as number[],
}));
const mocks = vi.hoisted(() => ({
  ingress: vi.fn(),
  user: vi.fn(),
  global: vi.fn(),
  tenant: vi.fn(),
  resolveTenant: vi.fn(),
  principal: vi.fn(),
  membership: vi.fn(),
  profile: vi.fn(),
  roles: vi.fn(),
  protected: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("@atlas/api/rate-limit", () => ({ enforceIngressRateLimit: mocks.ingress }));
vi.mock("@atlas/tenancy", () => ({ resolveTenantFromRequest: mocks.resolveTenant }));
vi.mock("@atlas/db/global-db", () => ({ withGlobalDb: mocks.global }));
vi.mock("@atlas/db/with-tenant-tx", () => ({ withTenantTx: mocks.tenant }));
vi.mock("@atlas/auth", () => ({
  requireSupabaseUser: mocks.user,
  upsertAuthPrincipal: mocks.principal,
  toSessionSafeIdentity: () => ({
    authenticated: true,
    email: "learner@example.test",
    emailNormalized: "learner@example.test",
    mfaEnabled: true,
    globalStatus: "active",
  }),
}));
vi.mock("@atlas/membership", async () => ({
  ...(await import("../../../backend/packages/membership/src/schemas")),
  requireActiveMembership: mocks.membership,
  findMemberProfile: mocks.profile,
  listMembershipRoles: mocks.roles,
}));
vi.mock("@atlas/authorization", () => ({ createTenantResourceRef: (value: unknown) => value }));
vi.mock("@atlas/api", async () => ({
  toSafeErrorEnvelope: (await import("@atlas/core/http/errors")).toSafeErrorEnvelope,
  runProtectedTenantRouteHandler: mocks.protected,
  enforceTenantRouteRateLimit: mocks.rateLimit,
}));
import { GET } from "../../../backend/apps/api/src/app/api/v1/me/route";

const request = () =>
  new NextRequest("https://tenant.example.test/api/v1/me", {
    headers: { host: "tenant.example.test" },
  });
beforeEach(() => {
  vi.resetAllMocks();
  state.globalDepth = 0;
  state.order = [];
  state.authDepths = [];
  state.tenantDepths = [];
  state.rateLimitDepths = [];
  mocks.ingress.mockResolvedValue(undefined);
  mocks.rateLimit.mockImplementation(async () => {
    state.rateLimitDepths.push(state.globalDepth);
    state.order.push("rate-limit");
  });
  mocks.user.mockImplementation(async () => {
    state.authDepths.push(state.globalDepth);
    state.order.push("authenticate");
    return {
      supabaseUserId: "supabase-user",
      email: "learner@example.test",
      mfaEnabled: true,
      sessionAssuranceLevel: "aal2",
    };
  });
  mocks.resolveTenant.mockResolvedValue({
    tenantId: "tenant",
    tenantSlug: "tenant-slug",
    tenantState: "active",
  });
  mocks.principal.mockResolvedValue({ id: "principal" });
  mocks.global.mockImplementation(async (callback: (db: object) => Promise<unknown>) => {
    state.globalDepth++;
    state.order.push("global-acquire");
    try {
      return await callback({});
    } finally {
      state.globalDepth--;
      state.order.push("global-release");
    }
  });
  mocks.tenant.mockImplementation(
    async (_ctx: unknown, callback: (tx: object) => Promise<unknown>) => {
      state.tenantDepths.push(state.globalDepth);
      // A single available connection cannot satisfy an inner checkout while
      // this request still owns its global transaction's connection.
      if (state.globalDepth > 0) throw new Error("Nested pool checkout would starve");
      state.order.push("tenant-acquire");
      return callback({});
    },
  );
  mocks.membership.mockResolvedValue({ membershipId: "membership" });
  mocks.profile.mockResolvedValue({ id: "profile", displayName: "Learner", avatarUrl: null });
  mocks.roles.mockResolvedValue([{ key: "learner" }]);
  mocks.protected.mockImplementation(
    async (args: {
      metadata: { resourceLoader: (context: unknown) => Promise<unknown> };
      handler: (context: unknown) => Promise<unknown>;
    }) => {
      const resource = await args.metadata.resourceLoader(args);
      return args.handler({ ...args, resource });
    },
  );
});

describe("identity route transaction lifetime", () => {
  it("reads the profile once per request and reloads the next request's profile", async () => {
    expect((await GET(request())).status).toBe(200);
    expect(mocks.profile).toHaveBeenCalledTimes(1);
    mocks.profile.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect((await response.json()).data.profile).toBeNull();
    expect(mocks.profile).toHaveBeenCalledTimes(2);
    expect(mocks.membership).toHaveBeenCalledTimes(2);
    expect(mocks.protected).toHaveBeenCalledTimes(2);
  });
  it("finishes identity lookup with a single available connection by releasing global work before tenant work", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(state.tenantDepths).toEqual([0]);
    expect(state.order.indexOf("global-release")).toBeLessThan(
      state.order.indexOf("tenant-acquire"),
    );
    // The per-actor rate limit waits on Redis holding no pooled connection.
    expect(state.rateLimitDepths).toEqual([0]);
    expect(state.order.indexOf("rate-limit")).toBeLessThan(state.order.indexOf("tenant-acquire"));
    expect(mocks.protected).toHaveBeenCalledWith(
      expect.objectContaining({ rateLimitEnforced: true }),
    );
    expect(await response.json()).toEqual({
      data: {
        tenant: { id: "tenant", slug: "tenant-slug", state: "active" },
        identity: {
          authenticated: true,
          email: "learner@example.test",
          emailNormalized: "learner@example.test",
          mfaEnabled: true,
          globalStatus: "active",
        },
        membership: { id: "membership", status: "ACTIVE", roleKeys: ["learner"] },
        profile: { id: "profile", displayName: "Learner", avatarUrl: null },
      },
    });
    expect(mocks.protected).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionAssuranceLevel: "aal2",
        metadata: expect.objectContaining({
          permission: "profile.read",
          rateLimit: "authenticatedTenantRead",
        }),
        ctx: expect.objectContaining({ tenantId: "tenant", actorMembershipId: "membership" }),
      }),
    );
  });
  it("does not hold a database connection during remote session verification", async () => {
    await GET(request());
    expect(state.authDepths).toEqual([0]);
  });
  it("rejects invalid sessions before acquiring a database connection", async () => {
    mocks.user.mockRejectedValue(
      new AtlasHttpError({ code: "UNAUTHENTICATED", status: 401, message: "Sign in required" }),
    );
    expect((await GET(request())).status).toBe(401);
    expect(mocks.global).not.toHaveBeenCalled();
    expect(mocks.tenant).not.toHaveBeenCalled();
  });
  it("keeps fresh membership and permission checks after the global transaction is released", async () => {
    expect((await GET(request())).status).toBe(200);
    mocks.membership.mockRejectedValueOnce(
      new AtlasHttpError({ code: "FORBIDDEN", status: 403, message: "Membership inactive" }),
    );
    expect((await GET(request())).status).toBe(403);
    expect(mocks.membership).toHaveBeenCalledTimes(2);
    expect(mocks.protected).toHaveBeenCalledTimes(1);
    mocks.protected.mockRejectedValueOnce(
      new AtlasHttpError({ code: "FORBIDDEN", status: 403, message: "Permission denied" }),
    );
    expect((await GET(request())).status).toBe(403);
  });
});
