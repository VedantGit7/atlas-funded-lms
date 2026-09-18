import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  addBillingLocation,
  listBillingLocations,
} from "@atlas/domain-config/services/learner-billing.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * One billing location per region.
 *
 * There is no unique index on (tenant_id, country). `ensureRestOfWorldLocation`
 * guards its own insert, but the add path did not, so the same country could be
 * added twice with two different currencies and nothing decided which one
 * applied to a learner in that region.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

function add(
  tenant: IsolationTenantFixture,
  args: { locationKey: string; title: string; currency: string },
) {
  const ctx = tenantCtx(tenant);
  return withTenantTx(ctx, async (tx) =>
    addBillingLocation(tx, {
      locationKey: args.locationKey,
      title: args.title,
      currency: args.currency,
      description: null,
    }),
  );
}

function list(tenant: IsolationTenantFixture) {
  const ctx = tenantCtx(tenant);
  return withTenantTx(ctx, async (tx) => listBillingLocations(tx));
}

describeWithDb("billing locations (database)", () => {
  it("adds a region that has no location yet", async () => {
    const { tenantA } = await createTenantIsolationFixture();

    const result = await add(tenantA, { locationKey: "IN", title: "India", currency: "INR" });

    expect(result.data.locationKey).toBe("IN");
    expect(result.data.currency).toBe("INR");
  });

  it("refuses a second location for the same region", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await add(tenantA, { locationKey: "IN", title: "India", currency: "INR" });

    // Two currencies both claiming one region is an ambiguity, not a richer
    // configuration.
    await expect(
      add(tenantA, { locationKey: "IN", title: "India", currency: "USD" }),
    ).rejects.toThrow(/already has a location/);
  });

  it("names the currency already in force when it refuses", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await add(tenantA, { locationKey: "IN", title: "India", currency: "INR" });

    await expect(
      add(tenantA, { locationKey: "IN", title: "India", currency: "USD" }),
    ).rejects.toThrow(/INR/);
  });

  it("matches the region case-insensitively", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await add(tenantA, { locationKey: "IN", title: "India", currency: "INR" });

    await expect(
      add(tenantA, { locationKey: "in", title: "India", currency: "USD" }),
    ).rejects.toThrow(/already has a location/);
  });

  it("refuses a second Rest Of The World row", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // Listing seeds the default row, and the picker offers "Rest of the World"
    // at the very top — so a duplicate default region was two clicks away.
    await list(tenantA);

    await expect(
      add(tenantA, { locationKey: "ROW", title: "Rest of the World", currency: "EUR" }),
    ).rejects.toThrow(/already has a location/);
  });

  it("leaves a different region free to be added", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await add(tenantA, { locationKey: "IN", title: "India", currency: "INR" });

    const result = await add(tenantA, {
      locationKey: "GB",
      title: "United Kingdom",
      currency: "GBP",
    });

    expect(result.data.locationKey).toBe("GB");
  });

  it("does not see another tenant's regions", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await add(tenantB, { locationKey: "IN", title: "India", currency: "INR" });

    // Each tenant configures its own regions; tenant B taking IN must not stop
    // tenant A from doing the same.
    const result = await add(tenantA, { locationKey: "IN", title: "India", currency: "USD" });

    expect(result.data.locationKey).toBe("IN");
  });

  it("seeds exactly one default row however often the list is read", async () => {
    const { tenantA } = await createTenantIsolationFixture();

    await list(tenantA);
    await list(tenantA);
    const result = await list(tenantA);

    const defaults = result.data.filter((location) => location.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.locationKey).toBe("ROW");
  });
});
