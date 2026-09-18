import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { consumeEntitlementUsage, readEntitlementUsage } from "@atlas/domain-config";
import { consumeEntitlementUnits, enforceEntitlement } from "@atlas/authorization";
import {
  createTenantIsolationFixture,
  tenantCtx,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Audit finding M11 — quantitative entitlements and per-tenant metering.
 *
 * `enforce-entitlement.ts` checked key existence only, never read
 * `value_json`, and declared a `usageContext` parameter it ignored. These run
 * against a real database because the guarantee is a unique index plus a
 * guarded upsert, not application logic.
 *
 * The gate and the meter are separate entry points: `enforceEntitlement` decides
 * whether the capability is available at all, `consumeEntitlementUnits` charges
 * a request against the plan. The route wrapper runs the first before the
 * permission check and the second after it.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function seedEntitlement(tenantId: string, key: string, value: unknown) {
  await withTenantTx(
    { tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
    async (tx) => {
      await tx.$executeRaw`
      INSERT INTO entitlements (id, tenant_id, key, value_json, source, starts_at, updated_at)
      VALUES (${randomUUID()}::uuid, ${tenantId}::uuid, ${key}, ${JSON.stringify(value)}::jsonb, 'platform', now() - interval '1 hour', now())
    `;
    },
  );
}

describeWithDb("entitlement metering (M11)", () => {
  it("enforces a quantitative limit and refuses the unit that crosses it", async () => {
    const fixture = await createTenantIsolationFixture();
    const key = `test.metered.${randomUUID().slice(0, 8)}`;
    await seedEntitlement(fixture.tenantA.tenantId, key, {
      enabled: true,
      limit: 3,
      period: "month",
    });

    const ctx = tenantCtx(fixture.tenantA);

    for (let i = 0; i < 3; i += 1) {
      await withTenantTx(ctx, async (tx) =>
        consumeEntitlementUnits(tx, {
          tenantId: fixture.tenantA.tenantId,
          key,
          requestId: randomUUID(),
          units: 1,
        }),
      );
    }

    await expect(
      withTenantTx(ctx, async (tx) =>
        consumeEntitlementUnits(tx, {
          tenantId: fixture.tenantA.tenantId,
          key,
          requestId: randomUUID(),
          units: 1,
        }),
      ),
    ).rejects.toMatchObject({ code: "ENTITLEMENT_LIMIT_EXCEEDED", status: 402 });

    const usage = await withTenantTx(ctx, async (tx) =>
      readEntitlementUsage(tx, { entitlementKey: key, period: "month" }),
    );
    // The refused request must not have advanced the counter.
    expect(usage?.used).toBe(3);
  });

  it("refuses a first request that alone exceeds the limit", async () => {
    // The counter row does not exist yet here. A guard on the conflict path only
    // would let this through, so a tenant limited to 5 could spend 500 in one
    // call simply by going first.
    const fixture = await createTenantIsolationFixture();
    const key = `test.firstover.${randomUUID().slice(0, 8)}`;
    await seedEntitlement(fixture.tenantA.tenantId, key, {
      enabled: true,
      limit: 5,
      period: "month",
    });

    await expect(
      withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
        consumeEntitlementUnits(tx, {
          tenantId: fixture.tenantA.tenantId,
          key,
          requestId: randomUUID(),
          units: 500,
        }),
      ),
    ).rejects.toMatchObject({ code: "ENTITLEMENT_LIMIT_EXCEEDED" });
  });

  it("treats { enabled: false } as denied", async () => {
    // The previous predicate was `value !== false && value !== null`, so any
    // object counted as enabled — including the explicit off switch.
    const fixture = await createTenantIsolationFixture();
    const key = `test.off.${randomUUID().slice(0, 8)}`;
    await seedEntitlement(fixture.tenantA.tenantId, key, { enabled: false, limit: 10 });

    await expect(
      withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
        enforceEntitlement(tx, {
          tenantId: fixture.tenantA.tenantId,
          key,
          requestId: randomUUID(),
        }),
      ),
    ).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
  });

  it("keeps the bare boolean form working", async () => {
    // Every seeded entitlement is a bare `true`. Rejecting them would have meant
    // a data migration before any of this could ship.
    const fixture = await createTenantIsolationFixture();
    const key = `test.bool.${randomUUID().slice(0, 8)}`;
    await seedEntitlement(fixture.tenantA.tenantId, key, true);

    await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      consumeEntitlementUnits(tx, {
        tenantId: fixture.tenantA.tenantId,
        key,
        requestId: randomUUID(),
        units: 1000,
      }),
    );

    const usage = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      readEntitlementUsage(tx, { entitlementKey: key, period: "month" }),
    );
    // Unlimited, but still metered — so turning a limit on later has history.
    expect(usage?.used).toBe(1000);
    expect(usage?.limit).toBeNull();
  });

  it("meters each tenant separately", async () => {
    const fixture = await createTenantIsolationFixture();
    const key = `test.pertenant.${randomUUID().slice(0, 8)}`;
    for (const tenant of [fixture.tenantA, fixture.tenantB]) {
      await seedEntitlement(tenant.tenantId, key, { enabled: true, limit: 2, period: "month" });
    }

    for (let i = 0; i < 2; i += 1) {
      await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
        consumeEntitlementUsage(tx, {
          tenantId: fixture.tenantA.tenantId,
          entitlementKey: key,
          period: "month",
          limit: 2,
          units: 1,
        }),
      );
    }

    // Tenant A is exhausted; tenant B must be untouched by that.
    const forB = await withTenantTx(tenantCtx(fixture.tenantB), async (tx) =>
      consumeEntitlementUsage(tx, {
        tenantId: fixture.tenantB.tenantId,
        entitlementKey: key,
        period: "month",
        limit: 2,
        units: 1,
      }),
    );
    expect(forB.allowed).toBe(true);
    expect(forB.used).toBe(1);
  });

  it("lets only one of two concurrent requests take the last unit", async () => {
    // The point of the guarded upsert. A read-then-write would let both through,
    // which is the C2/C3 double-spend shape on a new surface.
    const fixture = await createTenantIsolationFixture();
    const key = `test.race.${randomUUID().slice(0, 8)}`;
    await seedEntitlement(fixture.tenantA.tenantId, key, {
      enabled: true,
      limit: 1,
      period: "month",
    });

    const attempt = () =>
      withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
        consumeEntitlementUsage(tx, {
          tenantId: fixture.tenantA.tenantId,
          entitlementKey: key,
          period: "month",
          limit: 1,
          units: 1,
        }),
      ).catch(() => ({ allowed: false as const, used: 0, limit: 1 }));

    const results = await Promise.all([attempt(), attempt()]);
    expect(results.filter((r) => r.allowed)).toHaveLength(1);

    const usage = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      readEntitlementUsage(tx, { entitlementKey: key, period: "month" }),
    );
    expect(usage?.used).toBe(1);
  });
});
