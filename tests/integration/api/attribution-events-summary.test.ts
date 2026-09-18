import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  listAttributionEvents,
  summariseAttributionEvents,
} from "@atlas/domain/sales-marketing/sales-marketing.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Totals over the attribution log.
 *
 * The summary duplicates the list's filter predicate — it has to, because the
 * two are different shapes of query over the same table. The risk that buys is
 * drift, so the central test here runs both under every filter combination and
 * asserts they describe the same set of events.
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

describeWithDb("attribution summary (database)", () => {
  it("counts events with no attribution at all", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { source: null, medium: null, campaign: null },
      { source: null, medium: null, campaign: null },
      // A campaign alone still counts as attributed.
      { source: null, medium: null, campaign: "spring" },
      {},
    ]);
    const ctx = tenantCtx(tenantA);

    const summary = await withTenantTx(ctx, async (tx) => summariseAttributionEvents(tx, ctx, {}));

    expect(summary.data.total).toBe(4);
    expect(summary.data.noUtm).toBe(2);
    expect(summary.data.attributed).toBe(2);
  });

  it("agrees with the log under every filter combination", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { eventType: "purchase", revenueCents: 4900, currency: "USD" },
      { eventType: "purchase", revenueCents: 12050, currency: "EUR", source: "newsletter" },
      { eventType: "signup", source: null, medium: null, campaign: null },
      { eventType: "signup", source: "facebook", medium: "social" },
      { eventType: "page_view", source: null, medium: null, campaign: null },
      { eventType: "page_view" },
    ]);
    const ctx = tenantCtx(tenantA);

    const combinations = [
      {},
      { eventType: "purchase" },
      { eventType: "signup" },
      { attribution: "none" as const },
      { attribution: "attributed" as const },
      { attribution: "any" as const },
      { q: "facebook" },
      { q: "purchase" },
      { eventType: "signup", attribution: "none" as const },
      { eventType: "page_view", q: "google" },
    ];

    for (const filters of combinations) {
      const page = await withTenantTx(ctx, async (tx) =>
        listAttributionEvents(tx, ctx, { ...filters, limit: 100 }),
      );
      const summary = await withTenantTx(ctx, async (tx) =>
        summariseAttributionEvents(tx, ctx, filters),
      );

      // A signal band that disagrees with the table under it is worse than no
      // signal band.
      expect(summary.data.total, JSON.stringify(filters)).toBe(page.data.items.length);
    }
  });

  it("totals revenue per currency and never across them", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { eventType: "purchase", revenueCents: 4900, currency: "USD" },
      { eventType: "purchase", revenueCents: 100, currency: "USD" },
      { eventType: "purchase", revenueCents: 12050, currency: "EUR" },
      { eventType: "page_view" },
    ]);
    const ctx = tenantCtx(tenantA);

    const summary = await withTenantTx(ctx, async (tx) => summariseAttributionEvents(tx, ctx, {}));

    expect(summary.data.revenueEvents).toBe(3);
    expect(summary.data.revenueByCurrency).toEqual([
      { currency: "EUR", amountCents: 12050, events: 1 },
      { currency: "USD", amountCents: 5000, events: 2 },
    ]);
  });

  it("ranks event types and reports how many exist beyond the ones it names", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { eventType: "page_view" },
      { eventType: "page_view" },
      { eventType: "page_view" },
      { eventType: "signup" },
      { eventType: "purchase" },
    ]);
    const ctx = tenantCtx(tenantA);

    const summary = await withTenantTx(ctx, async (tx) => summariseAttributionEvents(tx, ctx, {}));

    expect(summary.data.eventTypes[0]).toEqual({ eventType: "page_view", total: 3 });
    expect(summary.data.eventTypeTotal).toBe(3);
  });

  it("keeps the unattributed events as their own source bucket", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { source: null, medium: null, campaign: null },
      { source: null, medium: null, campaign: null },
      {},
    ]);
    const ctx = tenantCtx(tenantA);

    const summary = await withTenantTx(ctx, async (tx) => summariseAttributionEvents(tx, ctx, {}));

    // Dropping the null bucket would make the breakdown add up to less than the
    // total, with nothing on screen to explain the gap.
    const totals = summary.data.sources.reduce((sum, entry) => sum + entry.total, 0);
    expect(totals).toBe(summary.data.total);
    expect(summary.data.sources.some((entry) => entry.source === null)).toBe(true);
  });

  it("reports the window the figures describe", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{ minutesAgo: 0 }, { minutesAgo: 500 }]);
    const ctx = tenantCtx(tenantA);

    const summary = await withTenantTx(ctx, async (tx) => summariseAttributionEvents(tx, ctx, {}));

    expect(summary.data.firstOccurredAt).not.toBeNull();
    expect(summary.data.lastOccurredAt).not.toBeNull();
    expect(Date.parse(summary.data.lastOccurredAt ?? "")).toBeGreaterThan(
      Date.parse(summary.data.firstOccurredAt ?? ""),
    );
  });

  it("reports an empty log as empty rather than failing", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const summary = await withTenantTx(ctx, async (tx) => summariseAttributionEvents(tx, ctx, {}));

    expect(summary.data.total).toBe(0);
    expect(summary.data.firstOccurredAt).toBeNull();
    expect(summary.data.sources).toEqual([]);
  });

  it("does not summarise another tenant's events", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seed(tenantA, [{}, {}]);
    await seed(tenantB, [{}, {}, {}, {}]);
    const ctx = tenantCtx(tenantA);

    const summary = await withTenantTx(ctx, async (tx) => summariseAttributionEvents(tx, ctx, {}));

    expect(summary.data.total).toBe(2);
  });
  it("returns all five UTM fields on the list, not three", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await withTenantTx(tenantCtx(tenantA), async (tx) => {
      await tx.$executeRaw`
        insert into sales_attribution_events (
          id, tenant_id, event_type, utm_source, utm_medium, utm_campaign,
          utm_term, utm_content, occurred_at, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid, ${tenantA.tenantId}::uuid, 'page_view',
          null, null, null, 'brand-search', 'banner-a', now(), now(), now()
        )
      `;
    });
    const ctx = tenantCtx(tenantA);

    const page = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { limit: 10 }),
    );
    const summary = await withTenantTx(ctx, async (tx) => summariseAttributionEvents(tx, ctx, {}));

    // The list row now sees the fields that attribute this event, so the table
    // and the signal band above it can no longer disagree about it.
    expect(page.data.items[0]?.utmTerm).toBe("brand-search");
    expect(page.data.items[0]?.utmContent).toBe("banner-a");
    expect(summary.data.attributed).toBe(1);
    expect(summary.data.noUtm).toBe(0);
  });
});
