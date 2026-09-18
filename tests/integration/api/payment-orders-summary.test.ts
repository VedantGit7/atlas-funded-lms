import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { listPaymentOrders, summarisePaymentOrders } from "@atlas/domain/payments/payments.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * The signal band's numbers, and the filters behind them.
 *
 * The page and the summary apply the same predicate written twice — the Prisma
 * boundary rules out a shared query builder — so the property worth pinning is
 * that they agree. A header that contradicts the table beneath it reads, on a
 * ledger, as missing money rather than as a bug.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type SeedOrder = {
  status: string;
  currency: string;
  amountCents: number;
  externalId: string | null;
  paidAt: "now" | null;
};

async function seed(tenant: IsolationTenantFixture, orders: SeedOrder[]): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (const [index, order] of orders.entries()) {
      await tx.$executeRaw`
        insert into payment_orders (
          id, tenant_id, membership_id, external_id, amount_cents, currency, status,
          paid_at, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid,
          ${tenant.tenantId}::uuid,
          ${tenant.membershipId}::uuid,
          ${order.externalId},
          ${order.amountCents},
          ${order.currency},
          ${order.status},
          ${order.paidAt === "now" ? new Date() : null}::timestamptz,
          now() - (${index} * interval '1 second'),
          now()
        )
      `;
    }
  });
}

const LEDGER: SeedOrder[] = [
  { status: "paid", currency: "INR", amountCents: 949900, externalId: "pi_a", paidAt: "now" },
  { status: "paid", currency: "INR", amountCents: 1250000, externalId: "pi_b", paidAt: "now" },
  // Paid but never timestamped: settled, and nobody can say when.
  { status: "paid", currency: "INR", amountCents: 899900, externalId: "pi_c", paidAt: null },
  { status: "pending", currency: "USD", amountCents: 14900, externalId: "ch_d", paidAt: null },
  // No external id: no webhook can ever match this row.
  { status: "pending", currency: "INR", amountCents: 499900, externalId: null, paidAt: null },
  { status: "pending", currency: "INR", amountCents: 100, externalId: "   ", paidAt: null },
  { status: "failed", currency: "INR", amountCents: 1249900, externalId: "pi_e", paidAt: null },
];

describeWithDb("payment order summary (database)", () => {
  it("counts the whole ledger by status, not the loaded page", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, LEDGER);
    const ctx = tenantCtx(tenantA);

    const summary = await withTenantTx(ctx, async (tx) => summarisePaymentOrders(tx, ctx, {}));

    expect(summary.data.total).toBe(7);
    expect(summary.data.byStatus).toEqual({ paid: 3, pending: 3, failed: 1 });
  });

  it("flags orders a webhook could never settle, including blank ids", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, LEDGER);
    const ctx = tenantCtx(tenantA);

    const summary = await withTenantTx(ctx, async (tx) => summarisePaymentOrders(tx, ctx, {}));

    // A whitespace-only external id matches nothing, exactly like a null one.
    expect(summary.data.missingExternalId).toBe(2);
  });

  it("flags paid orders with no settlement timestamp", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, LEDGER);
    const ctx = tenantCtx(tenantA);

    const summary = await withTenantTx(ctx, async (tx) => summarisePaymentOrders(tx, ctx, {}));
    expect(summary.data.paidWithoutTimestamp).toBe(1);
  });

  it("totals per currency and never across them", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, LEDGER);
    const ctx = tenantCtx(tenantA);

    const summary = await withTenantTx(ctx, async (tx) => summarisePaymentOrders(tx, ctx, {}));

    expect(summary.data.totalsByCurrency).toEqual([
      {
        currency: "INR",
        amountCents: 949900 + 1250000 + 899900 + 499900 + 100 + 1249900,
        count: 6,
      },
      { currency: "USD", amountCents: 14900, count: 1 },
    ]);
  });

  it("agrees with the page under every filter", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, LEDGER);
    const ctx = tenantCtx(tenantA);

    const filters = [
      {},
      { status: "paid" as const },
      { status: "pending" as const },
      { currency: "INR" },
      { currency: "usd" },
      { settlement: "settled" as const },
      { settlement: "unsettled" as const },
      { q: "pi_" },
      { q: "ch_d" },
      { status: "paid" as const, currency: "INR", settlement: "settled" as const },
    ];

    for (const filter of filters) {
      const page = await withTenantTx(ctx, async (tx) =>
        listPaymentOrders(tx, ctx, { ...filter, limit: 100 }),
      );
      const summary = await withTenantTx(ctx, async (tx) =>
        summarisePaymentOrders(tx, ctx, filter),
      );

      expect(summary.data.total, `filter ${JSON.stringify(filter)}`).toBe(page.data.items.length);
    }
  });

  it("matches a lower-case currency code against upper-case storage", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, LEDGER);
    const ctx = tenantCtx(tenantA);

    // An operator typing "inr" means INR; rejecting that silently returns zero
    // rows and looks like an empty ledger.
    const summary = await withTenantTx(ctx, async (tx) =>
      summarisePaymentOrders(tx, ctx, { currency: "inr" }),
    );
    expect(summary.data.total).toBe(6);
  });

  it("searches by membership id as well as external id", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, LEDGER);
    const ctx = tenantCtx(tenantA);

    const summary = await withTenantTx(ctx, async (tx) =>
      summarisePaymentOrders(tx, ctx, { q: tenantA.membershipId }),
    );
    expect(summary.data.total).toBe(7);
  });

  it("does not count another tenant's ledger", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seed(tenantA, LEDGER);
    await seed(tenantB, LEDGER);
    const ctx = tenantCtx(tenantA);

    const summary = await withTenantTx(ctx, async (tx) => summarisePaymentOrders(tx, ctx, {}));
    expect(summary.data.total).toBe(7);
  });
});
