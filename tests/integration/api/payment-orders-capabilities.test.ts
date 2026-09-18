import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bootstrapOwnerRoleForTenantSeed, seedTenantAccessControl } from "@atlas/access";
import { withTenantTx } from "@atlas/db";
import { summarisePaymentOrders } from "@atlas/domain/payments/payments.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Whether this operator may record a manual order.
 *
 * Reading the ledger is `reports.run`; recording an order is `config.update`,
 * so an analyst can hold the first and not the second. The record screen asks
 * the server before drawing the form, which is only worth anything if the
 * answer is a real authorization decision — a hardcoded `true` would let the
 * form be filled in and then throw the typing away on a 403.
 *
 * Both directions are asserted deliberately. A capability that is always false
 * passes a "denies without the role" test just as happily as a correct one.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("payment order capabilities (database)", () => {
  it("denies recording to a membership holding no roles", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const summary = await withTenantTx(ctx, async (tx) => summarisePaymentOrders(tx, ctx, {}));

    expect(summary.data.capabilities.canRecord).toBe(false);
  });

  it("allows recording once the membership holds a role carrying config.update", async () => {
    const { tenantA } = await createTenantIsolationFixture();

    await seedTenantAccessControl({ tenantId: tenantA.tenantId, requestId: randomUUID() });
    await withTenantTx(tenantCtx(tenantA), async (tx) => {
      await bootstrapOwnerRoleForTenantSeed({
        tx,
        tenantId: tenantA.tenantId,
        ownerMembershipId: tenantA.membershipId,
      });
    });

    const ctx = tenantCtx(tenantA);
    const summary = await withTenantTx(ctx, async (tx) => summarisePaymentOrders(tx, ctx, {}));

    expect(summary.data.capabilities.canRecord).toBe(true);
  });

  it("keeps the capability independent of the filters", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedTenantAccessControl({ tenantId: tenantA.tenantId, requestId: randomUUID() });
    await withTenantTx(tenantCtx(tenantA), async (tx) => {
      await bootstrapOwnerRoleForTenantSeed({
        tx,
        tenantId: tenantA.tenantId,
        ownerMembershipId: tenantA.membershipId,
      });
    });

    const ctx = tenantCtx(tenantA);
    // Filtering the ledger down to nothing must not read as "you cannot record".
    const summary = await withTenantTx(ctx, async (tx) =>
      summarisePaymentOrders(tx, ctx, { status: "refunded", q: "nothing-matches-this" }),
    );

    expect(summary.data.total).toBe(0);
    expect(summary.data.capabilities.canRecord).toBe(true);
  });
});
