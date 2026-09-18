import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { purgeExpiredAttributionEvents } from "@atlas/domain/sales-marketing/attribution-retention";
import {
  getAttributionRetention,
  listAttributionEvents,
  previewAttributionRetention,
  purgeAttributionEventsNow,
  setAttributionRetention,
} from "@atlas/domain/sales-marketing/sales-marketing.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Retention for the attribution event log.
 *
 * This is the one feature in this area that deletes data, so the tests are
 * weighted toward what must *not* happen: no deletion without an explicit
 * choice, no deletion of anything inside the window, and no reach across
 * tenants.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function seed(tenant: IsolationTenantFixture, agesInDays: number[]): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (const days of agesInDays) {
      await tx.$executeRaw`
        insert into sales_attribution_events (
          id, tenant_id, event_type, utm_source, occurred_at, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid, ${tenant.tenantId}::uuid, 'page_view', 'google',
          now() - make_interval(days => ${days}), now(), now()
        )
      `;
    }
  });
}

async function countEvents(tenant: IsolationTenantFixture): Promise<number> {
  const ctx = tenantCtx(tenant);
  const result = await withTenantTx(ctx, async (tx) =>
    listAttributionEvents(tx, ctx, { limit: 100 }),
  );
  return result.data.items.length;
}

describeWithDb("attribution retention (database)", () => {
  it("keeps everything until a tenant chooses otherwise", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [1, 400, 5000]);
    const ctx = tenantCtx(tenantA);

    const purged = await withTenantTx(ctx, async (tx) => purgeExpiredAttributionEvents(tx));

    // The single most important assertion here. The sweep runs for every
    // tenant; deletion has to be a choice a tenant made, never a default.
    expect(purged).toBe(0);
    expect(await countEvents(tenantA)).toBe(3);
  });

  it("reports no window as no window rather than as zero days", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [1, 400]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getAttributionRetention(tx, ctx));

    expect(result.data.retentionDays).toBeNull();
    expect(result.data.deletableNow).toBe(0);
    expect(result.data.totalEvents).toBe(2);
  });

  it("previews the impact without deleting anything", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [1, 100, 200, 400]);
    const ctx = tenantCtx(tenantA);

    const preview = await withTenantTx(ctx, async (tx) =>
      previewAttributionRetention(tx, ctx, { retentionDays: 90 }),
    );

    expect(preview.data.deletable).toBe(3);
    expect(preview.data.totalEvents).toBe(4);
    // A preview that deleted would be a trap, not a preview.
    expect(await countEvents(tenantA)).toBe(4);
  });

  it("saving a window does not delete on its own", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [1, 400]);
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) => setAttributionRetention(tx, ctx, { retentionDays: 30 }));

    // Deletion happens on the sweep or on an explicit purge, so a mistyped
    // window can still be corrected before any row is gone.
    expect(await countEvents(tenantA)).toBe(2);
  });

  it("purges only what falls outside the window", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [1, 29, 31, 400]);
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) => setAttributionRetention(tx, ctx, { retentionDays: 30 }));
    const purged = await withTenantTx(ctx, async (tx) => purgeExpiredAttributionEvents(tx));

    expect(purged).toBe(2);
    expect(await countEvents(tenantA)).toBe(2);
  });

  it("refuses a window below the floor", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    // A week of attribution history cannot answer the question the log exists
    // for, so the floor is the safety cap rather than a ceiling.
    await expect(
      withTenantTx(ctx, async (tx) => setAttributionRetention(tx, ctx, { retentionDays: 7 })),
    ).rejects.toThrow();
  });

  it("lets a tenant switch retention back off", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [1, 400]);
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) => setAttributionRetention(tx, ctx, { retentionDays: 30 }));
    await withTenantTx(ctx, async (tx) =>
      setAttributionRetention(tx, ctx, { retentionDays: null }),
    );
    const purged = await withTenantTx(ctx, async (tx) => purgeExpiredAttributionEvents(tx));

    expect(purged).toBe(0);
    expect(await countEvents(tenantA)).toBe(2);
  });

  it("reports whether more remain after a manual purge", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [400, 401, 402]);
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) => setAttributionRetention(tx, ctx, { retentionDays: 30 }));
    const result = await withTenantTx(ctx, async (tx) => purgeAttributionEventsNow(tx, ctx));

    expect(result.data.deleted).toBe(3);
    // Well under the batch limit, so nothing is queued behind this.
    expect(result.data.moreRemaining).toBe(false);
  });

  it("stops at the batch limit rather than holding a lock over the whole table", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(
      tenantA,
      Array.from({ length: 5 }, (_, index) => 400 + index),
    );
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) => setAttributionRetention(tx, ctx, { retentionDays: 30 }));
    const first = await withTenantTx(ctx, async (tx) => purgeExpiredAttributionEvents(tx, 2));

    expect(first).toBe(2);
    expect(await countEvents(tenantA)).toBe(3);
  });

  it("records who set the window", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) => setAttributionRetention(tx, ctx, { retentionDays: 90 }));
    const result = await withTenantTx(ctx, async (tx) => getAttributionRetention(tx, ctx));

    expect(result.data.retentionDays).toBe(90);
    expect(result.data.updatedAt).not.toBeNull();
  });

  it("does not purge another tenant's events", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seed(tenantA, [400, 401]);
    await seed(tenantB, [400, 401, 402]);
    const ctxA = tenantCtx(tenantA);

    await withTenantTx(ctxA, async (tx) =>
      setAttributionRetention(tx, ctxA, { retentionDays: 30 }),
    );
    const purged = await withTenantTx(ctxA, async (tx) => purgeExpiredAttributionEvents(tx));

    expect(purged).toBe(2);
    // Tenant B never opted in and must be untouched.
    expect(await countEvents(tenantB)).toBe(3);
  });

  it("does not read another tenant's retention setting", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const ctxA = tenantCtx(tenantA);
    const ctxB = tenantCtx(tenantB);

    await withTenantTx(ctxA, async (tx) =>
      setAttributionRetention(tx, ctxA, { retentionDays: 45 }),
    );
    const forB = await withTenantTx(ctxB, async (tx) => getAttributionRetention(tx, ctxB));

    expect(forB.data.retentionDays).toBeNull();
  });
});
