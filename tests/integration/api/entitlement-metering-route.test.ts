import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Metering reached through the real route wrapper.
 *
 * `entitlement-metering.test.ts` proves the counter's arithmetic by calling the
 * domain function directly — which is exactly how the mechanism came to be
 * complete and unreachable. These go through `runProtectedTenantRoutePipeline`,
 * the path a request actually takes, so a route that declares
 * `entitlementUsage` is proven to charge the tenant and a route that declares
 * none is proven not to.
 *
 * Only `can` is mocked. The permission decision has its own suites and the
 * isolation fixture's membership holds no roles, so a real decision would deny
 * everything and prove nothing. Everything else is real: the entitlement rows,
 * the usage counter and its guarded upsert all run against the database.
 */

const canMock = vi.fn();

vi.mock("@atlas/authorization", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, can: (...args: unknown[]) => canMock(...args) };
});

const { withTenantTx } = await import("@atlas/db");
const { readEntitlementUsage } = await import("@atlas/domain-config");
const { runProtectedTenantRoutePipeline } = await import("@atlas/api/create-tenant-route");
const { createTenantIsolationFixture, tenantCtx } =
  await import("../../tenant-isolation/tenant-isolation-fixture");

type Fixture = Awaited<ReturnType<typeof createTenantIsolationFixture>>["tenantA"];

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const ENTITLEMENT_KEY = "gamification.enable";

async function seedEntitlement(tenantId: string, value: unknown): Promise<void> {
  await withTenantTx(
    { tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
    async (tx) => {
      await tx.$executeRaw`
        INSERT INTO entitlements (id, tenant_id, key, value_json, source, starts_at, updated_at)
        VALUES (
          ${randomUUID()}::uuid, ${tenantId}::uuid, ${ENTITLEMENT_KEY},
          ${JSON.stringify(value)}::jsonb, 'platform', now() - interval '1 hour', now()
        )
      `;
    },
  );
}

const BASE = {
  permission: "gamification.profile.read",
  entitlement: ENTITLEMENT_KEY,
  rateLimit: "authenticatedTenantRead",
  audit: "none",
  idempotency: "none",
} as const;

function runPipeline(tenant: Fixture, metadata: Record<string, unknown>): Promise<unknown> {
  return withTenantTx(tenantCtx(tenant), async (tx) =>
    runProtectedTenantRoutePipeline({
      tx,
      ctx: {
        tenantId: tenant.tenantId,
        requestId: randomUUID(),
        actorMembershipId: tenant.membershipId,
      },
      metadata: metadata as never,
      params: {},
      input: undefined,
    }),
  );
}

function usage(tenant: Fixture) {
  return withTenantTx(tenantCtx(tenant), async (tx) =>
    readEntitlementUsage(tx, { entitlementKey: ENTITLEMENT_KEY, period: "month" }),
  );
}

describeWithDb("entitlement metering through the route wrapper", () => {
  beforeEach(() => {
    canMock.mockReset();
    canMock.mockResolvedValue({ allowed: true });
  });

  it("charges the tenant when a route declares usage", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: true, limit: null, period: "month" });

    await runPipeline(tenantA, { ...BASE, entitlementUsage: () => 1 });

    // The point of the whole change: a metadata field on a route moved a
    // counter in the database, with nothing calling the domain function by hand.
    expect((await usage(tenantA))?.used).toBe(1);
  });

  it("charges nothing when a route declares no usage", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: true, limit: null, period: "month" });

    await runPipeline(tenantA, { ...BASE });

    // Every existing route is this case; adding metering must not have started
    // billing all of them.
    expect(await usage(tenantA)).toBeNull();
  });

  it("does not charge a caller who fails the permission check", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: true, limit: null, period: "month" });
    canMock.mockResolvedValue({ allowed: false, reason: "no_grant" });

    await expect(runPipeline(tenantA, { ...BASE, entitlementUsage: () => 1 })).rejects.toThrow();

    // Metering before the permission decision would let anyone who can reach
    // the endpoint drain the quota the tenant is paying for.
    expect(await usage(tenantA)).toBeNull();
  });

  it("refuses the request that would cross the plan limit", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: true, limit: 2, period: "month" });

    const call = () => runPipeline(tenantA, { ...BASE, entitlementUsage: () => 1 });

    await call();
    await call();
    await expect(call()).rejects.toMatchObject({
      code: "ENTITLEMENT_LIMIT_EXCEEDED",
      status: 402,
    });

    // The refused request must not have advanced the counter.
    expect((await usage(tenantA))?.used).toBe(2);
  });

  it("meters the units the route computes, not a flat one", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: true, limit: null, period: "month" });

    // The shape a byte-metered upload or a bulk import would use.
    await runPipeline(tenantA, { ...BASE, entitlementUsage: () => 25 });

    expect((await usage(tenantA))?.used).toBe(25);
  });

  it("passes the request's own input to the usage function", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: true, limit: null, period: "month" });

    // Without the input a route could only ever meter a constant, which defeats
    // metering an upload or an import.
    const seen: unknown[] = [];
    await withTenantTx(tenantCtx(tenantA), async (tx) =>
      runProtectedTenantRoutePipeline({
        tx,
        ctx: {
          tenantId: tenantA.tenantId,
          requestId: randomUUID(),
          actorMembershipId: tenantA.membershipId,
        },
        metadata: {
          ...BASE,
          entitlementUsage: (args: { input: unknown }) => {
            seen.push(args.input);
            return 4;
          },
        } as never,
        params: {},
        input: { rows: 4 } as never,
      }),
    );

    expect(seen).toEqual([{ rows: 4 }]);
    expect((await usage(tenantA))?.used).toBe(4);
  });

  it("lets a zero-unit request through without charging", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: true, limit: 1, period: "month" });

    // An upload of nothing should not fail, and should not consume the only
    // unit the plan allows.
    await runPipeline(tenantA, { ...BASE, entitlementUsage: () => 0 });

    expect(await usage(tenantA)).toBeNull();
  });

  it("denies a disabled entitlement even with no usage declared", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: false, limit: 10, period: "month" });

    // The bug this closes: the value parse sat behind an early return for
    // requests with no usage context — which was every request — so an explicit
    // off switch still granted access.
    await expect(runPipeline(tenantA, { ...BASE })).rejects.toMatchObject({
      code: "ENTITLEMENT_REQUIRED",
    });
  });

  it("denies a disabled entitlement before the permission check runs", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedEntitlement(tenantA.tenantId, { enabled: false, limit: 10, period: "month" });

    await expect(runPipeline(tenantA, { ...BASE })).rejects.toThrow();

    // The gate stays ahead of `can`, as it was before metering existed.
    expect(canMock).not.toHaveBeenCalled();
  });

  it("keeps a bare boolean entitlement working", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // Every entitlement seeded in this system is a bare `true`.
    await seedEntitlement(tenantA.tenantId, true);

    await runPipeline(tenantA, { ...BASE, entitlementUsage: () => 3 });

    const record = await usage(tenantA);
    // Unlimited, but still metered — so turning a limit on later has history.
    expect(record?.used).toBe(3);
    expect(record?.limit).toBeNull();
  });

  it("meters each tenant against its own plan", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    for (const tenant of [tenantA, tenantB]) {
      await seedEntitlement(tenant.tenantId, { enabled: true, limit: 1, period: "month" });
    }

    await runPipeline(tenantA, { ...BASE, entitlementUsage: () => 1 });
    // Tenant A is exhausted; tenant B must still have its own unit.
    await runPipeline(tenantB, { ...BASE, entitlementUsage: () => 1 });

    expect((await usage(tenantA))?.used).toBe(1);
    expect((await usage(tenantB))?.used).toBe(1);
  });
});
