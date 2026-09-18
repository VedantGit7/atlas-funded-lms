import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { getUnmatchedPaymentOrders } from "@atlas/domain/payments/payments.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * The reconciliation worklist.
 *
 * The property that matters is that it scans the whole ledger. A worklist
 * assembled from one loaded page reports clean books while the stuck order sits
 * on page nine — so the counts are tested past the sample cap, and against rows
 * that a fifty-row page would never have reached.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type SeedOrder = {
  externalId?: string | null;
  status?: string;
  paidAt?: string | null;
  ageDays?: number;
};

async function seed(tenant: IsolationTenantFixture, orders: SeedOrder[]): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (const order of orders) {
      await tx.$executeRaw`
        insert into payment_orders (
          id, tenant_id, membership_id, external_id, amount_cents, currency, status,
          paid_at, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${tenant.membershipId}::uuid,
          ${order.externalId === undefined ? "pay_ok" : order.externalId},
          1000, 'INR', ${order.status ?? "pending"},
          ${order.paidAt ?? null}::timestamptz,
          now() - make_interval(days => ${order.ageDays ?? 0}),
          now()
        )
      `;
    }
  });
}

function group(
  result: Awaited<ReturnType<typeof getUnmatchedPaymentOrders>>,
  fault: string,
): { total: number; items: unknown[]; truncated: boolean } {
  const found = result.data.groups.find((entry) => entry.fault === fault);
  if (!found) throw new Error(`missing group ${fault}`);
  return found;
}

describeWithDb("unmatched payment orders (database)", () => {
  it("finds each fault and leaves healthy orders out", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { externalId: null },
      // Whitespace matches no webhook either, exactly like a null.
      { externalId: "   " },
      { status: "pending", ageDays: 30 },
      { status: "paid", paidAt: null },
      // Healthy: settled, identified, timestamped.
      { status: "paid", paidAt: new Date().toISOString() },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getUnmatchedPaymentOrders(tx, ctx, {}));

    expect(group(result, "missing-external-id").total).toBe(2);
    expect(group(result, "stale-pending").total).toBe(1);
    expect(group(result, "paid-without-timestamp").total).toBe(1);
    expect(result.data.scannedTotal).toBe(5);
    expect(result.data.affectedTotal).toBe(4);
  });

  it("counts an order stuck for two reasons once in the total", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // No external id AND pending for a month.
    await seed(tenantA, [{ externalId: null, status: "pending", ageDays: 40 }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getUnmatchedPaymentOrders(tx, ctx, {}));

    // It belongs in both groups — hiding half the reason it is stuck would be
    // worse than listing it twice.
    expect(group(result, "missing-external-id").total).toBe(1);
    expect(group(result, "stale-pending").total).toBe(1);
    // But it is still one order.
    expect(result.data.affectedTotal).toBe(1);
  });

  it("honours the staleness threshold", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{ status: "pending", ageDays: 10 }]);
    const ctx = tenantCtx(tenantA);

    const atSeven = await withTenantTx(ctx, async (tx) => getUnmatchedPaymentOrders(tx, ctx, {}));
    const atThirty = await withTenantTx(ctx, async (tx) =>
      getUnmatchedPaymentOrders(tx, ctx, { stalePendingDays: 30 }),
    );

    expect(group(atSeven, "stale-pending").total).toBe(1);
    expect(group(atThirty, "stale-pending").total).toBe(0);
    expect(atThirty.data.stalePendingDays).toBe(30);
  });

  it("counts past the sample cap instead of reporting the sample size", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // More than the 50-row sample, and far more than a ledger page.
    await seed(
      tenantA,
      Array.from({ length: 60 }, () => ({ externalId: null })),
    );
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getUnmatchedPaymentOrders(tx, ctx, {}));

    const missing = group(result, "missing-external-id");
    expect(missing.total).toBe(60);
    expect(missing.items).toHaveLength(result.data.sampleLimit);
    // The screen has to be able to say so rather than implying 50 is all of it.
    expect(missing.truncated).toBe(true);
  });

  it("lists a worklist oldest first, inverting the ledger", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { externalId: null, ageDays: 1 },
      { externalId: null, ageDays: 20 },
      { externalId: null, ageDays: 10 },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getUnmatchedPaymentOrders(tx, ctx, {}));

    const items = group(result, "missing-external-id").items as Array<{ createdAt: string }>;
    const times = items.map((item) => new Date(item.createdAt).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("names the longest-standing affected order", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { externalId: "pay_recent", status: "paid", paidAt: null, ageDays: 2 },
      { externalId: null, ageDays: 45 },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getUnmatchedPaymentOrders(tx, ctx, {}));

    // The oldest overall, not the oldest of whichever group lists first.
    expect(result.data.oldest?.externalId).toBeNull();
  });

  it("reports a clean ledger as clean", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { status: "paid", paidAt: new Date().toISOString() },
      { status: "pending", ageDays: 1 },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getUnmatchedPaymentOrders(tx, ctx, {}));

    expect(result.data.affectedTotal).toBe(0);
    expect(result.data.oldest).toBeNull();
    for (const entry of result.data.groups) {
      expect(entry.total).toBe(0);
      expect(entry.truncated).toBe(false);
    }
  });

  it("does not scan another tenant's ledger", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seed(tenantA, [{ externalId: null }]);
    await seed(
      tenantB,
      Array.from({ length: 5 }, () => ({ externalId: null })),
    );
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getUnmatchedPaymentOrders(tx, ctx, {}));

    expect(result.data.scannedTotal).toBe(1);
    expect(group(result, "missing-external-id").total).toBe(1);
  });
});
