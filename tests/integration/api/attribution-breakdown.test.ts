import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  getAttributionBreakdown,
  listAttributionEvents,
} from "@atlas/domain/sales-marketing/sales-marketing.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * The attribution breakdown.
 *
 * The property that matters is that it scans the whole log. A breakdown
 * assembled from one loaded page ranks campaigns by whichever fifty events the
 * screen happened to fetch, and the ranking changes as the operator scrolls —
 * so the totals are tested past a page boundary.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type SeedEvent = {
  eventType?: string;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  revenueCents?: number | null;
  currency?: string | null;
  minutesAgo?: number;
};

async function seed(tenant: IsolationTenantFixture, events: SeedEvent[]): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (const [index, event] of events.entries()) {
      await tx.$executeRaw`
        insert into sales_attribution_events (
          id, tenant_id, event_type, utm_source, utm_medium, utm_campaign,
          revenue_cents, currency, occurred_at, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid, ${tenant.tenantId}::uuid,
          ${event.eventType ?? "page_view"},
          ${event.source === undefined ? "google" : event.source},
          ${event.medium === undefined ? "cpc" : event.medium},
          ${event.campaign === undefined ? "launch" : event.campaign},
          ${event.revenueCents ?? null}, ${event.currency ?? null},
          now() - make_interval(mins => ${event.minutesAgo ?? index}), now(), now()
        )
      `;
    }
  });
}

function group(result: Awaited<ReturnType<typeof getAttributionBreakdown>>, value: string | null) {
  return result.data.groups.find((entry) => entry.value === value);
}

describeWithDb("attribution breakdown (database)", () => {
  it("groups the whole log, not one page of it", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // 60 on one source and 5 on another. A 50-row page would rank these wrong.
    await seed(tenantA, [
      ...Array.from({ length: 60 }, () => ({ source: "google", minutesAgo: 200 })),
      ...Array.from({ length: 5 }, () => ({ source: "bing", minutesAgo: 1 })),
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionBreakdown(tx, ctx, { dimension: "source" }),
    );

    expect(result.data.totalEvents).toBe(65);
    expect(result.data.groups[0]?.value).toBe("google");
    expect(result.data.groups[0]?.events).toBe(60);
    expect(group(result, "bing")?.events).toBe(5);
  });

  it("groups by campaign, an axis nothing else in the console could", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { campaign: "aug-intake" },
      { campaign: "aug-intake" },
      { campaign: "reactivation" },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionBreakdown(tx, ctx, { dimension: "campaign" }),
    );

    expect(result.data.dimension).toBe("campaign");
    expect(group(result, "aug-intake")?.events).toBe(2);
    expect(group(result, "reactivation")?.events).toBe(1);
  });

  it("keeps the unattributed events as their own group", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { source: null, medium: null, campaign: null },
      { source: null, medium: null, campaign: null },
      {},
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionBreakdown(tx, ctx, { dimension: "source" }),
    );

    // Dropping the null group would make the rows add up to less than the
    // total, with nothing on screen to explain the gap.
    const sum = result.data.groups.reduce((total, entry) => total + entry.events, 0);
    expect(sum).toBe(result.data.totalEvents);
    expect(group(result, null)?.events).toBe(2);
  });

  it("agrees with the log under the same filters", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { eventType: "purchase", source: "google" },
      { eventType: "purchase", source: "bing" },
      { eventType: "signup", source: "google" },
      { eventType: "signup", source: null, medium: null, campaign: null },
    ]);
    const ctx = tenantCtx(tenantA);

    for (const filters of [
      {},
      { eventType: "purchase" },
      { eventType: "signup" },
      { attribution: "none" as const },
      { attribution: "attributed" as const },
      { q: "bing" },
    ]) {
      const page = await withTenantTx(ctx, async (tx) =>
        listAttributionEvents(tx, ctx, { ...filters, limit: 100 }),
      );
      const breakdown = await withTenantTx(ctx, async (tx) =>
        getAttributionBreakdown(tx, ctx, { ...filters, dimension: "source" }),
      );

      // A breakdown that disagrees with the table it was derived from is worse
      // than no breakdown.
      expect(breakdown.data.totalEvents, JSON.stringify(filters)).toBe(page.data.items.length);
    }
  });

  it("splits revenue per currency and never across them", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { source: "google", revenueCents: 4900, currency: "USD" },
      { source: "google", revenueCents: 100, currency: "USD" },
      { source: "google", revenueCents: 12050, currency: "EUR" },
      { source: "google" },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionBreakdown(tx, ctx, { dimension: "source" }),
    );

    const google = group(result, "google");
    expect(google?.events).toBe(4);
    expect(google?.revenueEvents).toBe(3);
    expect(google?.revenueByCurrency).toEqual([
      { currency: "EUR", amountCents: 12050, events: 1 },
      { currency: "USD", amountCents: 5000, events: 2 },
    ]);
  });

  it("counts revenue recorded with no currency rather than dropping it", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // The amount cannot join any per-currency total, so it would otherwise
    // vanish from every figure on the screen.
    await seed(tenantA, [{ source: "google", revenueCents: 8900, currency: null }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionBreakdown(tx, ctx, { dimension: "source" }),
    );

    expect(result.data.revenueWithoutCurrency).toBe(1);
    expect(group(result, "google")?.revenueWithoutCurrency).toBe(1);
    expect(group(result, "google")?.revenueByCurrency).toEqual([]);
  });

  it("reports each group's first and last sighting", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { source: "google", minutesAgo: 500 },
      { source: "google", minutesAgo: 1 },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionBreakdown(tx, ctx, { dimension: "source" }),
    );

    const google = group(result, "google");
    expect(Date.parse(google?.lastSeen ?? "")).toBeGreaterThan(Date.parse(google?.firstSeen ?? ""));
  });

  it("counts distinct values on all three axes", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { source: "google", medium: "cpc", campaign: "a" },
      { source: "google", medium: "organic", campaign: "b" },
      { source: "bing", medium: "cpc", campaign: "a" },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionBreakdown(tx, ctx, { dimension: "source" }),
    );

    expect(result.data.distinctSources).toBe(2);
    expect(result.data.distinctMediums).toBe(2);
    expect(result.data.distinctCampaigns).toBe(2);
  });

  it("builds a source-by-medium cross-tab", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { source: "google", medium: "cpc" },
      { source: "google", medium: "cpc" },
      { source: "google", medium: "organic" },
      { source: "bing", medium: "cpc" },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionBreakdown(tx, ctx, { dimension: "source" }),
    );

    // google/cpc and google/organic are different channels; a single-dimension
    // table collapses them into one row.
    const cell = result.data.matrix.cells.find(
      (entry) => entry.source === "google" && entry.medium === "cpc",
    );
    expect(cell?.events).toBe(2);
    expect(result.data.matrix.sources).toContain("google");
    expect(result.data.matrix.mediums).toContain("organic");
  });

  it("says when the axis holds more values than it returned", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(
      tenantA,
      Array.from({ length: 6 }, (_, index) => ({ source: `source_${String(index)}` })),
    );
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionBreakdown(tx, ctx, { dimension: "source", limit: 2 }),
    );

    expect(result.data.groups).toHaveLength(2);
    expect(result.data.groupTotal).toBe(6);
    expect(result.data.truncated).toBe(true);
  });

  it("reports an empty log as empty rather than failing", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionBreakdown(tx, ctx, { dimension: "campaign" }),
    );

    expect(result.data.totalEvents).toBe(0);
    expect(result.data.groups).toEqual([]);
    expect(result.data.firstOccurredAt).toBeNull();
  });

  it("does not group another tenant's log", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seed(tenantA, [{ source: "google" }]);
    await seed(
      tenantB,
      Array.from({ length: 5 }, () => ({ source: "facebook" })),
    );
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionBreakdown(tx, ctx, { dimension: "source" }),
    );

    expect(result.data.totalEvents).toBe(1);
    expect(group(result, "facebook")).toBeUndefined();
  });
});
