import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { listPaymentOrders } from "@atlas/domain/payments/payments.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Keyset pagination over the payment order ledger.
 *
 * The ledger is ordered by `created_at desc, id desc`, so the cursor has to
 * carry both. Comparing ids alone only works when ids sort the same way as the
 * timestamps — and these ids are random v4 UUIDs, so they do not. That makes a
 * page boundary drop rows and repeat others, which on a financial ledger means
 * an operator paging through orders never sees some of them.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

/** Orders one second apart, so `created_at` ordering is unambiguous. */
async function seedOrders(tenant: IsolationTenantFixture, count: number): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (let index = 0; index < count; index += 1) {
      await tx.$executeRaw`
        insert into payment_orders (
          id, tenant_id, membership_id, external_id, amount_cents, currency, status,
          created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid,
          ${tenant.tenantId}::uuid,
          ${tenant.membershipId}::uuid,
          ${`ext_${String(index)}_${randomUUID().slice(0, 8)}`},
          ${1000 + index},
          'INR',
          'pending',
          now() - (${index} * interval '1 second'),
          now()
        )
      `;
    }
  });
}

async function pageThrough(tenant: IsolationTenantFixture, limit: number): Promise<string[]> {
  const ctx = tenantCtx(tenant);
  const seen: string[] = [];
  let cursor: string | undefined;

  // Bounded so a cursor that fails to advance cannot spin forever.
  for (let page = 0; page < 20; page += 1) {
    const response = await withTenantTx(ctx, async (tx) =>
      listPaymentOrders(tx, ctx, { limit, ...(cursor ? { cursor } : {}) }),
    );
    for (const item of response.data.items) seen.push(item.id);
    const next = response.data.pageInfo.nextCursor;
    if (next === null) break;
    cursor = next;
  }

  return seen;
}

describeWithDb("payment order pagination (database)", () => {
  it("returns every order exactly once when paging", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedOrders(tenantA, 9);

    const seen = await pageThrough(tenantA, 2);

    // The failure this guards is silent: a broken cursor still returns rows, it
    // just returns the wrong ones.
    expect(new Set(seen).size).toBe(9);
    expect(seen).toHaveLength(9);
  });

  it("pages in the same order the first page established", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedOrders(tenantA, 8);
    const ctx = tenantCtx(tenantA);

    const all = await withTenantTx(ctx, async (tx) => listPaymentOrders(tx, ctx, { limit: 100 }));
    const paged = await pageThrough(tenantA, 3);

    expect(paged).toEqual(all.data.items.map((item) => item.id));
  });

  it("stops cleanly when the last page is exactly full", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedOrders(tenantA, 4);

    // An off-by-one here shows up as an endless "Load more" that returns nothing.
    const seen = await pageThrough(tenantA, 4);
    expect(seen).toHaveLength(4);
  });
});
