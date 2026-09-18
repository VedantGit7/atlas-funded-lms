import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { highestIssuedInvoiceSequence } from "@atlas/domain-config/repositories/learner-billing.repository";
import { updateLearnerBillingInvoice } from "@atlas/domain-config/services/learner-billing.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * The invoice counter cannot be wound back over numbers already printed.
 *
 * `payment_orders.invoice_number` is only indexed, not unique, so nothing in
 * the database prevents two orders sharing a number. Once both invoices are
 * out, that cannot be undone.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function seedInvoices(
  tenant: IsolationTenantFixture,
  invoiceNumbers: Array<string | null>,
): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (const invoiceNumber of invoiceNumbers) {
      await tx.$executeRaw`
        insert into payment_orders (
          id, tenant_id, membership_id, external_id, amount_cents, currency, status,
          invoice_number, paid_at, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${tenant.membershipId}::uuid,
          ${`pay_${randomUUID().slice(0, 8)}`}, 10000, 'INR', 'paid',
          ${invoiceNumber}, now(), now(), now()
        )
      `;
    }
  });
}

function save(
  tenant: IsolationTenantFixture,
  args: { prefix: string; nextNumber: number; businessName?: string },
) {
  const ctx = tenantCtx(tenant);
  return withTenantTx(ctx, async (tx) =>
    updateLearnerBillingInvoice(tx, {
      prefix: args.prefix,
      nextNumber: args.nextNumber,
      businessName: args.businessName ?? "Atlas",
    }),
  );
}

describeWithDb("invoice counter (database)", () => {
  it("refuses a number that has already been printed", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedInvoices(tenantA, ["INV-00007"]);

    await expect(save(tenantA, { prefix: "INV", nextNumber: 7 })).rejects.toThrow(/INV-00007/);
  });

  it("refuses a number below the highest issued, not merely the exact one", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedInvoices(tenantA, ["INV-00003", "INV-00009"]);

    // 5 is unused, but re-running the counter from there walks straight back
    // over 9.
    await expect(save(tenantA, { prefix: "INV", nextNumber: 5 })).rejects.toThrow(/INV-00009/);
  });

  it("accepts the next number after the highest issued", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedInvoices(tenantA, ["INV-00009"]);

    const result = await save(tenantA, { prefix: "INV", nextNumber: 10 });

    expect(result.data.invoice.nextNumber).toBe(10);
  });

  it("accepts any starting point under a prefix that has issued nothing", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedInvoices(tenantA, ["INV-00500"]);

    // A different prefix is a different series, so it starts wherever it likes.
    const result = await save(tenantA, { prefix: "ACME", nextNumber: 1 });

    expect(result.data.invoice.prefix).toBe("ACME");
    expect(result.data.invoice.nextNumber).toBe(1);
  });

  it("saves freely when no invoice has ever been issued", async () => {
    const { tenantA } = await createTenantIsolationFixture();

    const result = await save(tenantA, { prefix: "INV", nextNumber: 1 });

    expect(result.data.invoice.nextNumber).toBe(1);
  });

  it("ignores orders that carry no invoice number", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedInvoices(tenantA, [null, null]);

    const result = await save(tenantA, { prefix: "INV", nextNumber: 1 });

    expect(result.data.invoice.nextNumber).toBe(1);
  });

  it("does not read a longer prefix that merely starts the same way", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // "INVX" is its own series; a prefix match on "INV" would wrongly claim it.
    await seedInvoices(tenantA, ["INVX-00900"]);

    const result = await save(tenantA, { prefix: "INV", nextNumber: 1 });

    expect(result.data.invoice.nextNumber).toBe(1);
  });

  it("ignores the fallback numbers that carry an order id rather than a sequence", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // allocateInvoiceNumber falls back to `INV-<order id fragment>` when the
    // counter is missing; that tail is not a number and must not be parsed.
    await seedInvoices(tenantA, ["INV-A1B2C3D4"]);

    const result = await save(tenantA, { prefix: "INV", nextNumber: 1 });

    expect(result.data.invoice.nextNumber).toBe(1);
  });

  it("does not see another tenant's invoices", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seedInvoices(tenantB, ["INV-09999"]);

    const result = await save(tenantA, { prefix: "INV", nextNumber: 1 });

    expect(result.data.invoice.nextNumber).toBe(1);
  });

  it("reports the highest issued sequence directly", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedInvoices(tenantA, ["INV-00002", "INV-00031", "INV-00004"]);
    const ctx = tenantCtx(tenantA);

    const highest = await withTenantTx(ctx, async (tx) => highestIssuedInvoiceSequence(tx, "INV"));

    expect(highest).toBe(31);
  });

  it("reports nothing for a series that has issued nothing", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const highest = await withTenantTx(ctx, async (tx) => highestIssuedInvoiceSequence(tx, "INV"));

    expect(highest).toBeNull();
  });
});
