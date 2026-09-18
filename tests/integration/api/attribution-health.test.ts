import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { getAttributionHealth } from "@atlas/domain/sales-marketing/sales-marketing.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * The attribution log's daily health.
 *
 * Every other surface in this area reports a single aggregate, which cannot
 * show the two failures that matter: a beacon that stopped days ago, and an
 * attribution rate that collapsed on a particular day. These tests are mostly
 * about the shape of the series — a silent day has to be a zero, not a gap.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type SeedEvent = {
  daysAgo: number;
  attributed?: boolean;
  eventType?: string;
  revenueCents?: number | null;
  /** Seconds the server clock ran behind the reported time. */
  skewSeconds?: number;
};

async function seed(tenant: IsolationTenantFixture, events: SeedEvent[]): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (const event of events) {
      const attributed = event.attributed ?? true;
      await tx.$executeRaw`
        insert into sales_attribution_events (
          id, tenant_id, event_type, utm_source, utm_medium, utm_campaign,
          revenue_cents, occurred_at, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid, ${tenant.tenantId}::uuid,
          ${event.eventType ?? "page_view"},
          ${attributed ? "google" : null},
          ${attributed ? "cpc" : null},
          ${attributed ? "launch" : null},
          ${event.revenueCents ?? null},
          now() - make_interval(days => ${event.daysAgo}, hours => 2),
          now() - make_interval(days => ${event.daysAgo}, hours => 2)
            + make_interval(secs => ${event.skewSeconds ?? 0}),
          now()
        )
      `;
    }
  });
}

describeWithDb("attribution health (database)", () => {
  it("returns one entry per day, zero-filling the silent ones", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // Days 1 and 5 only. Everything between must still be a row.
    await seed(tenantA, [{ daysAgo: 1 }, { daysAgo: 5 }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionHealth(tx, ctx, { days: 7 }),
    );

    expect(result.data.series).toHaveLength(7);
    // A chart that skipped the gap would draw a continuous line through it.
    const zeroDays = result.data.series.filter((entry) => entry.total === 0);
    expect(zeroDays.length).toBe(5);
    expect(result.data.windowTotal).toBe(2);
  });

  it("orders the series oldest to newest", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{ daysAgo: 0 }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionHealth(tx, ctx, { days: 14 }),
    );

    const times = result.data.series.map((entry) => Date.parse(entry.day));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    // Today is the last bucket, so a fresh event lands at the end.
    expect(result.data.series.at(-1)?.total).toBe(1);
  });

  it("counts trailing silent days, which a total cannot show", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // Plenty of events, but none recently — the failure a headline count hides.
    await seed(
      tenantA,
      Array.from({ length: 20 }, () => ({ daysAgo: 9 })),
    );
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionHealth(tx, ctx, { days: 14 }),
    );

    expect(result.data.windowTotal).toBe(20);
    expect(result.data.trailingSilentDays).toBe(9);
    expect(result.data.silentDays).toBe(9);
  });

  it("separates attributed from unattributed per day", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { daysAgo: 1, attributed: true },
      { daysAgo: 1, attributed: false },
      { daysAgo: 1, attributed: false },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionHealth(tx, ctx, { days: 7 }),
    );

    const day = result.data.series.find((entry) => entry.total > 0);
    expect(day?.total).toBe(3);
    // A rate that collapses on one day is the signal; a window total hides it.
    expect(day?.attributed).toBe(1);
  });

  it("counts events whose reported and recorded times disagree", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { daysAgo: 1, skewSeconds: 0 },
      // Queued or replayed: lands in the wrong reporting day.
      { daysAgo: 1, skewSeconds: 3600 },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionHealth(tx, ctx, { days: 7 }),
    );

    expect(result.data.windowSkewed).toBe(1);
    expect(result.data.skewToleranceSeconds).toBe(300);
  });

  it("reports when each event type was last seen", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { daysAgo: 0, eventType: "page_view" },
      { daysAgo: 0, eventType: "page_view" },
      // A funnel stage that stopped a week ago, invisible in any total.
      { daysAgo: 8, eventType: "purchase" },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionHealth(tx, ctx, { days: 14 }),
    );

    const purchase = result.data.eventTypes.find((entry) => entry.eventType === "purchase");
    const pageView = result.data.eventTypes.find((entry) => entry.eventType === "page_view");
    expect(pageView?.total).toBe(2);
    expect(purchase?.total).toBe(1);
    expect(Date.parse(purchase?.lastSeenAt ?? "")).toBeLessThan(
      Date.parse(pageView?.lastSeenAt ?? ""),
    );
  });

  it("counts revenue events per day", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { daysAgo: 1, revenueCents: 4900 },
      { daysAgo: 1, revenueCents: null },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionHealth(tx, ctx, { days: 7 }),
    );

    expect(result.data.series.find((entry) => entry.total > 0)?.revenueEvents).toBe(1);
  });

  it("honours the window length", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{ daysAgo: 3 }, { daysAgo: 40 }]);
    const ctx = tenantCtx(tenantA);

    const short = await withTenantTx(ctx, async (tx) => getAttributionHealth(tx, ctx, { days: 7 }));
    const long = await withTenantTx(ctx, async (tx) => getAttributionHealth(tx, ctx, { days: 60 }));

    expect(short.data.series).toHaveLength(7);
    expect(short.data.windowTotal).toBe(1);
    expect(long.data.windowTotal).toBe(2);
  });

  it("reports an empty log as empty rather than failing", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionHealth(tx, ctx, { days: 7 }),
    );

    expect(result.data.windowTotal).toBe(0);
    expect(result.data.lastEventAt).toBeNull();
    // Never silent "since forever" — there was never anything to go silent.
    expect(result.data.silentDays).toBeNull();
    expect(result.data.series).toHaveLength(7);
  });

  it("does not read another tenant's log", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seed(tenantA, [{ daysAgo: 1 }]);
    await seed(
      tenantB,
      Array.from({ length: 5 }, () => ({ daysAgo: 1 })),
    );
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionHealth(tx, ctx, { days: 7 }),
    );

    expect(result.data.windowTotal).toBe(1);
  });
});
