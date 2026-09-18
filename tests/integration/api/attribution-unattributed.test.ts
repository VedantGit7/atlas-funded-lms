import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  getAttributionGaps,
  summariseAttributionEvents,
} from "@atlas/domain/sales-marketing/sales-marketing.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Events that cannot be credited to a campaign.
 *
 * The kind that matters here is partial attribution, which nothing else in the
 * console detects: an event with a source but no campaign passes the "any UTM
 * field" test everywhere and is counted as attributed, while still landing in a
 * breakdown row that reads "(not set)".
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type SeedEvent = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  revenueCents?: number | null;
  currency?: string | null;
  daysAgo?: number;
};

async function seed(tenant: IsolationTenantFixture, events: SeedEvent[]): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (const event of events) {
      await tx.$executeRaw`
        insert into sales_attribution_events (
          id, tenant_id, event_type, utm_source, utm_medium, utm_campaign, utm_term,
          revenue_cents, currency, occurred_at, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid, ${tenant.tenantId}::uuid, 'page_view',
          ${event.source === undefined ? "google" : event.source},
          ${event.medium === undefined ? "cpc" : event.medium},
          ${event.campaign === undefined ? "launch" : event.campaign},
          ${event.term ?? null},
          ${event.revenueCents ?? null},
          ${event.currency === undefined ? null : event.currency},
          now() - make_interval(days => ${event.daysAgo ?? 1}), now(), now()
        )
      `;
    }
  });
}

function group(result: Awaited<ReturnType<typeof getAttributionGaps>>, kind: string) {
  return result.data.groups.find((entry) => entry.kind === kind);
}

describeWithDb("attribution gaps (database)", () => {
  it("separates nothing-at-all from a partial set", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { source: null, medium: null, campaign: null },
      // Carries a source but no campaign: creditable to nothing, yet counted as
      // attributed everywhere else.
      { campaign: null },
      { source: null, medium: null },
      // Fully attributed.
      {},
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getAttributionGaps(tx, ctx, {}));

    // Two different problems with two different fixes; one number would merge a
    // marketing problem with a templating one.
    expect(group(result, "no-utm")?.total).toBe(1);
    expect(group(result, "partial")?.total).toBe(2);
    expect(result.data.affectedTotal).toBe(3);
    expect(result.data.scannedTotal).toBe(4);
  });

  it("catches the case the rest of the console calls attributed", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{ campaign: null }]);
    const ctx = tenantCtx(tenantA);

    const gaps = await withTenantTx(ctx, async (tx) => getAttributionGaps(tx, ctx, {}));
    const summary = await withTenantTx(ctx, async (tx) => summariseAttributionEvents(tx, ctx, {}));

    // The summary counts it as attributed — it carries a UTM field — and this
    // screen is the only place that says it still cannot be credited.
    expect(summary.data.attributed).toBe(1);
    expect(summary.data.noUtm).toBe(0);
    expect(group(gaps, "partial")?.total).toBe(1);
  });

  it("names which fields each partial event is missing", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{ medium: null, campaign: null }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getAttributionGaps(tx, ctx, {}));

    expect(group(result, "partial")?.items[0]?.missing).toEqual(["medium", "campaign"]);
  });

  it("counts which field is missing across the window", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { campaign: null },
      { campaign: null },
      { campaign: null },
      { medium: null },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getAttributionGaps(tx, ctx, {}));

    // The actionable figure: one field of one link template, not "something is
    // wrong".
    expect(result.data.missingCampaign).toBe(3);
    expect(result.data.missingMedium).toBe(1);
    expect(result.data.missingSource).toBe(0);
  });

  it("treats an event attributed only by utm_term as partial, not as nothing", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // Something arrived, so it is not "no UTM" — but none of the three fields
    // the rollups group by are present.
    await seed(tenantA, [{ source: null, medium: null, campaign: null, term: "brand" }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getAttributionGaps(tx, ctx, {}));

    expect(group(result, "no-utm")?.total).toBe(0);
    expect(group(result, "partial")?.total).toBe(1);
    expect(group(result, "partial")?.items[0]?.missing).toEqual(["source", "medium", "campaign"]);
  });

  it("leaves a fully attributed event out of both groups", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{}, {}]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getAttributionGaps(tx, ctx, {}));

    expect(result.data.affectedTotal).toBe(0);
    expect(result.data.scannedTotal).toBe(2);
  });

  it("counts revenue without currency for the cross-link", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { revenueCents: 4900, currency: null },
      { revenueCents: 100, currency: "USD" },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getAttributionGaps(tx, ctx, {}));

    // Counted here, listed on the anomalies screen — one list, not two to keep
    // in step.
    expect(result.data.revenueWithoutCurrency).toBe(1);
  });

  it("honours the window", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { source: null, medium: null, campaign: null, daysAgo: 2 },
      { source: null, medium: null, campaign: null, daysAgo: 40 },
    ]);
    const ctx = tenantCtx(tenantA);

    const short = await withTenantTx(ctx, async (tx) => getAttributionGaps(tx, ctx, { days: 7 }));
    const long = await withTenantTx(ctx, async (tx) => getAttributionGaps(tx, ctx, { days: 60 }));

    expect(group(short, "no-utm")?.total).toBe(1);
    expect(group(long, "no-utm")?.total).toBe(2);
  });

  it("counts past the sample cap instead of reporting the sample size", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(
      tenantA,
      Array.from({ length: 60 }, () => ({ source: null, medium: null, campaign: null })),
    );
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getAttributionGaps(tx, ctx, {}));

    const noUtm = group(result, "no-utm");
    expect(noUtm?.total).toBe(60);
    expect(noUtm?.items).toHaveLength(result.data.sampleLimit);
    expect(noUtm?.truncated).toBe(true);
  });

  it("does not scan another tenant's log", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seed(tenantA, [{ campaign: null }]);
    await seed(
      tenantB,
      Array.from({ length: 4 }, () => ({ campaign: null })),
    );
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) => getAttributionGaps(tx, ctx, {}));

    expect(result.data.scannedTotal).toBe(1);
    expect(group(result, "partial")?.total).toBe(1);
  });
});
