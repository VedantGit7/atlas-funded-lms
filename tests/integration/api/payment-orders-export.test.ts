import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { exportPaymentOrders, listPaymentOrders } from "@atlas/domain/payments/payments.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Exporting the whole filtered ledger.
 *
 * The screen could previously only export the rows it had loaded — fifty at a
 * time — so a year of orders meant paging through the entire history first.
 * The properties worth pinning are that the export agrees with the list under
 * the same filters, and that it never truncates silently.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function seedOrders(
  tenant: IsolationTenantFixture,
  count: number,
  status = "pending",
): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (let index = 0; index < count; index += 1) {
      await tx.$executeRaw`
        insert into payment_orders (
          id, tenant_id, membership_id, external_id, amount_cents, currency, status,
          created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${tenant.membershipId}::uuid,
          ${`ext_${status}_${String(index)}`}, ${1000 + index}, 'INR', ${status},
          now() - (${index} * interval '1 second'), now()
        )
      `;
    }
  });
}

describeWithDb("payment order export (database)", () => {
  it("returns every matching order, not just one page", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // More than the ledger's 50-row page size.
    await seedOrders(tenantA, 60);
    const ctx = tenantCtx(tenantA);

    const exported = await withTenantTx(ctx, async (tx) => exportPaymentOrders(tx, ctx, {}));

    expect(exported.data.items).toHaveLength(60);
    expect(exported.data.totalCount).toBe(60);
    expect(exported.data.truncated).toBe(false);
  });

  it("applies the same filters as the ledger", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedOrders(tenantA, 5, "paid");
    await seedOrders(tenantA, 3, "failed");
    const ctx = tenantCtx(tenantA);

    const exported = await withTenantTx(ctx, async (tx) =>
      exportPaymentOrders(tx, ctx, { status: "failed" }),
    );
    const listed = await withTenantTx(ctx, async (tx) =>
      listPaymentOrders(tx, ctx, { status: "failed", limit: 100 }),
    );

    expect(exported.data.items).toHaveLength(3);
    // A file that disagrees with the screen it was exported from is worse than
    // no file at all.
    expect(exported.data.items.map((item) => item.id).sort()).toEqual(
      listed.data.items.map((item) => item.id).sort(),
    );
  });

  it("orders newest first, matching the ledger", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedOrders(tenantA, 6);
    const ctx = tenantCtx(tenantA);

    const exported = await withTenantTx(ctx, async (tx) => exportPaymentOrders(tx, ctx, {}));
    const listed = await withTenantTx(ctx, async (tx) =>
      listPaymentOrders(tx, ctx, { limit: 100 }),
    );

    expect(exported.data.items.map((item) => item.id)).toEqual(
      listed.data.items.map((item) => item.id),
    );
  });

  it("reports the true total even when nothing matches", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedOrders(tenantA, 4);
    const ctx = tenantCtx(tenantA);

    const exported = await withTenantTx(ctx, async (tx) =>
      exportPaymentOrders(tx, ctx, { q: "matches-nothing" }),
    );

    expect(exported.data.items).toHaveLength(0);
    expect(exported.data.totalCount).toBe(0);
    expect(exported.data.truncated).toBe(false);
  });

  it("does not export another tenant's ledger", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seedOrders(tenantA, 3);
    await seedOrders(tenantB, 7);
    const ctx = tenantCtx(tenantA);

    const exported = await withTenantTx(ctx, async (tx) => exportPaymentOrders(tx, ctx, {}));
    expect(exported.data.items).toHaveLength(3);
    expect(exported.data.totalCount).toBe(3);
  });
});
