import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  exportAttributionEvents,
  getAttributionBreakdown,
  listAttributionEvents,
  summariseAttributionEvents,
} from "@atlas/domain/sales-marketing/sales-marketing.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Exact narrowing on source, medium and campaign.
 *
 * The log already had `q`, a text search across every UTM field — so searching
 * "google" also matched a campaign named google. A breakdown row drilling into
 * its own axis needs the exact form, or the events it opens are not the events
 * it counted. These tests pin that difference, and that every read applies the
 * narrowing identically.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type SeedEvent = {
  eventType?: string;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
};

async function seed(tenant: IsolationTenantFixture, events: SeedEvent[]): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (const [index, event] of events.entries()) {
      await tx.$executeRaw`
        insert into sales_attribution_events (
          id, tenant_id, event_type, utm_source, utm_medium, utm_campaign,
          occurred_at, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid, ${tenant.tenantId}::uuid,
          ${event.eventType ?? "page_view"},
          ${event.source === undefined ? "google" : event.source},
          ${event.medium === undefined ? "cpc" : event.medium},
          ${event.campaign === undefined ? "launch" : event.campaign},
          now() - make_interval(secs => ${index}), now(), now()
        )
      `;
    }
  });
}

describeWithDb("attribution UTM filters (database)", () => {
  it("narrows to an exact source without matching the same word elsewhere", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { source: "google", campaign: "spring" },
      // A campaign named after a different source. `q` would match both.
      { source: "newsletter", campaign: "google" },
    ]);
    const ctx = tenantCtx(tenantA);

    const exact = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { utmSource: "google", limit: 50 }),
    );
    const search = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { q: "google", limit: 50 }),
    );

    expect(exact.data.items).toHaveLength(1);
    expect(exact.data.items[0]?.utmCampaign).toBe("spring");
    // The whole reason the exact form had to exist.
    expect(search.data.items).toHaveLength(2);
  });

  it("narrows to an exact medium and campaign", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { medium: "cpc", campaign: "spring" },
      { medium: "organic", campaign: "spring" },
      { medium: "cpc", campaign: "autumn" },
    ]);
    const ctx = tenantCtx(tenantA);

    const byMedium = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { utmMedium: "cpc", limit: 50 }),
    );
    const byBoth = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { utmMedium: "cpc", utmCampaign: "spring", limit: 50 }),
    );

    expect(byMedium.data.items).toHaveLength(2);
    expect(byBoth.data.items).toHaveLength(1);
  });

  it("does not match on a prefix", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{ campaign: "spring" }, { campaign: "spring-sale" }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { utmCampaign: "spring", limit: 50 }),
    );

    // Exact means exact; `spring-sale` is a different campaign and its events
    // must not be credited to `spring`.
    expect(result.data.items).toHaveLength(1);
  });

  it("narrows to events where one axis was never set", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      // Attributed, but with no campaign — invisible to `attribution=none`.
      { source: "google", medium: "cpc", campaign: null },
      { source: "google", medium: "cpc", campaign: "spring" },
      { source: null, medium: null, campaign: null },
    ]);
    const ctx = tenantCtx(tenantA);

    const noCampaign = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { utmCampaignUnset: true, limit: 50 }),
    );
    const noUtmAtAll = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { attribution: "none", limit: 50 }),
    );

    // Two different questions: "this axis is unset" and "every axis is unset".
    expect(noCampaign.data.items).toHaveLength(2);
    expect(noUtmAtAll.data.items).toHaveLength(1);
  });

  it("treats a false unset flag as no narrowing at all", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{ campaign: "spring" }, { campaign: null }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { utmCampaignUnset: false, limit: 50 }),
    );

    expect(result.data.items).toHaveLength(2);
  });

  it("applies identically across the list, summary, breakdown and export", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { source: "google", medium: "cpc", campaign: "spring" },
      { source: "google", medium: "organic", campaign: "spring" },
      { source: "bing", medium: "cpc", campaign: "spring" },
      { source: "google", medium: "cpc", campaign: null },
    ]);
    const ctx = tenantCtx(tenantA);

    for (const filters of [
      { utmSource: "google" },
      { utmMedium: "cpc" },
      { utmCampaign: "spring" },
      { utmSource: "google", utmMedium: "cpc" },
      { utmCampaignUnset: true },
      { utmSource: "google", utmCampaignUnset: true },
    ]) {
      const label = JSON.stringify(filters);
      const page = await withTenantTx(ctx, async (tx) =>
        listAttributionEvents(tx, ctx, { ...filters, limit: 100 }),
      );
      const summary = await withTenantTx(ctx, async (tx) =>
        summariseAttributionEvents(tx, ctx, filters),
      );
      const breakdown = await withTenantTx(ctx, async (tx) =>
        getAttributionBreakdown(tx, ctx, { ...filters, dimension: "source" }),
      );
      const exported = await withTenantTx(ctx, async (tx) =>
        exportAttributionEvents(tx, ctx, filters),
      );

      // Four reads, one predicate, repeated eight times in SQL because a
      // fragment cannot cross the Prisma boundary. This is what keeps the
      // copies honest.
      expect(summary.data.total, label).toBe(page.data.items.length);
      expect(breakdown.data.totalEvents, label).toBe(page.data.items.length);
      expect(exported.data.totalCount, label).toBe(page.data.items.length);
    }
  });

  it("makes a breakdown row's drill-down return exactly its own events", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { source: "google", campaign: "spring" },
      { source: "google", campaign: "autumn" },
      // Same word, different axis — the case the text search got wrong.
      { source: "newsletter", campaign: "google" },
    ]);
    const ctx = tenantCtx(tenantA);

    const breakdown = await withTenantTx(ctx, async (tx) =>
      getAttributionBreakdown(tx, ctx, { dimension: "source" }),
    );
    const google = breakdown.data.groups.find((entry) => entry.value === "google");

    const drilled = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { utmSource: "google", limit: 100 }),
    );

    // The row counted 2; the link now opens exactly those 2.
    expect(google?.events).toBe(2);
    expect(drilled.data.items).toHaveLength(2);
  });

  it("does not reach another tenant's events", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seed(tenantA, [{ source: "google" }]);
    await seed(tenantB, [{ source: "google" }, { source: "google" }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { utmSource: "google", limit: 50 }),
    );

    expect(result.data.items).toHaveLength(1);
  });
});
