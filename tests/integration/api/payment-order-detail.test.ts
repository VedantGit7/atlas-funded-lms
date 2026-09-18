import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { createPaymentOrder, getPaymentOrder } from "@atlas/domain/payments/payments.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Reading one order by id.
 *
 * The detail screen used to be assembled from whatever the ledger list had
 * already fetched, so an order further back in the cursor-paginated history
 * read as missing when it was merely unloaded. This endpoint is what makes the
 * difference between "no such order" and "not on this page" real.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

/** Columns the ledger list never returns, so the detail read has something to prove. */
async function insertRichOrder(tenant: IsolationTenantFixture): Promise<string> {
  const id = randomUUID();
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into payment_orders (
        id, tenant_id, membership_id, external_id, amount_cents, currency, status,
        metadata_json, gateway_key, product_title, product_type, coupon_amount_cents,
        tax_amount_cents, invoice_number, billing_name, paid_at, created_at, updated_at
      )
      values (
        ${id}::uuid, ${tenant.tenantId}::uuid, ${tenant.membershipId}::uuid,
        'pi_detail_1', 1249900, 'INR', 'paid',
        ${JSON.stringify({ manualEntryNote: "Bank transfer confirmed by finance" })}::jsonb,
        'stripe', 'Advanced Options Trading', 'course', 50000, 22500,
        'INV-2026-0042', 'Priya Raghunathan', now(), now(), now()
      )
    `;
  });
  return id;
}

describeWithDb("payment order detail (database)", () => {
  it("returns the columns the ledger list leaves out", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const orderId = await insertRichOrder(tenantA);
    const ctx = tenantCtx(tenantA);

    const order = await withTenantTx(ctx, async (tx) => getPaymentOrder(tx, ctx, orderId));

    expect(order.data.id).toBe(orderId);
    expect(order.data.gatewayKey).toBe("stripe");
    expect(order.data.invoiceNumber).toBe("INV-2026-0042");
    expect(order.data.billingName).toBe("Priya Raghunathan");
    expect(order.data.productTitle).toBe("Advanced Options Trading");
    expect(order.data.couponAmountCents).toBe(50000);
    expect(order.data.taxAmountCents).toBe(22500);
  });

  it("returns the stored metadata rather than hiding it", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const orderId = await insertRichOrder(tenantA);
    const ctx = tenantCtx(tenantA);

    const order = await withTenantTx(ctx, async (tx) => getPaymentOrder(tx, ctx, orderId));

    // For a manually recorded order this is the operator's stated reason, and
    // usually the only thing that explains the row months later.
    expect(order.data.metadataJson).toEqual({
      manualEntryNote: "Bank transfer confirmed by finance",
    });
  });

  it("reads back an order recorded through the create path", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const created = await withTenantTx(ctx, async (tx) =>
      createPaymentOrder(tx, ctx, {
        amountCents: 34900,
        currency: "USD",
        status: "pending",
        metadataJson: { manualEntryNote: "Cash at the front desk" },
      }),
    );

    const order = await withTenantTx(ctx, async (tx) => getPaymentOrder(tx, ctx, created.data.id));

    expect(order.data.amountCents).toBe(34900);
    expect(order.data.metadataJson).toEqual({ manualEntryNote: "Cash at the front desk" });
    // Nothing settled it, so both must be absent rather than defaulted.
    expect(order.data.externalId).toBeNull();
    expect(order.data.paidAt).toBeNull();
  });

  it("leaves metadata null when none was stored", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const created = await withTenantTx(ctx, async (tx) =>
      createPaymentOrder(tx, ctx, { amountCents: 100, currency: "INR", status: "pending" }),
    );
    const order = await withTenantTx(ctx, async (tx) => getPaymentOrder(tx, ctx, created.data.id));

    // Not `{}`: "nothing was recorded" and "an empty object was recorded" are
    // different claims on a ledger row.
    expect(order.data.metadataJson).toBeNull();
  });

  it("404s for an id that does not exist", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    await expect(
      withTenantTx(ctx, async (tx) => getPaymentOrder(tx, ctx, randomUUID())),
    ).rejects.toThrow(/Payment order not found/);
  });

  it("404s for an order belonging to another tenant", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const foreignOrderId = await insertRichOrder(tenantB);
    const ctx = tenantCtx(tenantA);

    // A valid id from another ledger must be indistinguishable from a made-up
    // one — anything else confirms the order exists.
    await expect(
      withTenantTx(ctx, async (tx) => getPaymentOrder(tx, ctx, foreignOrderId)),
    ).rejects.toThrow(/Payment order not found/);
  });
});
