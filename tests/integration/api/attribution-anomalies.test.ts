import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { getAttributionAnomalies } from "@atlas/domain/sales-marketing/sales-marketing.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * The attribution log scanned for faults.
 *
 * Three of these kinds are detected nowhere else in the console — a
 * double-firing tag, a template published with its placeholder intact, and an
 * event dated in the future. The other two are counted on the health screen;
 * here they are listed, which is the difference between knowing something is
 * wrong and knowing which events to look at.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type SeedEvent = {
  eventType?: string;
  source?: string | null;
  campaign?: string | null;
  term?: string | null;
  revenueCents?: number | null;
  currency?: string | null;
  /** Hours from now; negative is the past. */
  hoursAgo?: number;
  skewSeconds?: number;
  withMembership?: boolean;
};

async function seed(tenant: IsolationTenantFixture, events: SeedEvent[]): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (const event of events) {
      await tx.$executeRaw`
        insert into sales_attribution_events (
          id, tenant_id, membership_id, event_type,
          utm_source, utm_medium, utm_campaign, utm_term,
          revenue_cents, currency, occurred_at, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid, ${tenant.tenantId}::uuid,
          ${event.withMembership === false ? null : tenant.membershipId}::uuid,
          ${event.eventType ?? "page_view"},
          ${event.source === undefined ? "google" : event.source},
          'cpc',
          ${event.campaign === undefined ? "launch" : event.campaign},
          ${event.term ?? null},
          ${event.revenueCents ?? null},
          ${event.currency === undefined ? null : event.currency},
          now() - make_interval(hours => ${event.hoursAgo ?? 1}),
          now() - make_interval(hours => ${event.hoursAgo ?? 1})
            + make_interval(secs => ${event.skewSeconds ?? 0}),
          now()
        )
      `;
    }
  });
}

function group(result: Awaited<ReturnType<typeof getAttributionAnomalies>>, kind: string) {
  return result.data.groups.find((entry) => entry.kind === kind);
}

describeWithDb("attribution anomalies (database)", () => {
  it("finds a double-fired tag", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // Same learner, same type, same instant — a tag manager firing twice.
    await withTenantTx(tenantCtx(tenantA), async (tx) => {
      for (let index = 0; index < 2; index += 1) {
        await tx.$executeRaw`
          insert into sales_attribution_events (
            id, tenant_id, membership_id, event_type, utm_source, occurred_at,
            created_at, updated_at
          )
          values (
            ${randomUUID()}::uuid, ${tenantA.tenantId}::uuid,
            ${tenantA.membershipId}::uuid, 'purchase', 'google',
            '2026-08-20T10:00:00Z'::timestamptz, now(), now()
          )
        `;
      }
    });
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionAnomalies(tx, ctx, { days: 180 }),
    );

    const duplicates = group(result, "duplicate");
    expect(duplicates?.total).toBe(2);
    expect(duplicates?.items[0]?.copies).toBe(2);
  });

  it("does not call two ordinary events a duplicate", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // Same learner and type, different instants — normal browsing.
    await seed(tenantA, [
      { eventType: "page_view", hoursAgo: 1 },
      { eventType: "page_view", hoursAgo: 2 },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionAnomalies(tx, ctx, { days: 30 }),
    );

    expect(group(result, "duplicate")?.total).toBe(0);
  });

  it("finds a template published with its placeholder intact", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { campaign: "{{campaign_name}}" },
      { source: "${utm_source}" },
      // URL-encoded, which is how it usually actually arrives.
      { campaign: "%7B%7Bcampaign%7D%7D" },
      { campaign: "spring-sale" },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionAnomalies(tx, ctx, { days: 30 }),
    );

    // Each of these silently invents a campaign in every rollup.
    expect(group(result, "unrendered-placeholder")?.total).toBe(3);
  });

  it("scans utm_term as well as the visible fields", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{ term: "{{keyword}}" }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionAnomalies(tx, ctx, { days: 30 }),
    );

    expect(group(result, "unrendered-placeholder")?.total).toBe(1);
  });

  it("finds an event dated in the future", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{ hoursAgo: -5 }, { hoursAgo: 1 }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionAnomalies(tx, ctx, { days: 30 }),
    );

    // A future timestamp poisons today's bucket on every daily chart.
    expect(group(result, "future-dated")?.total).toBe(1);
  });

  it("lists skewed events rather than only counting them", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{ skewSeconds: 7200 }, { skewSeconds: 0 }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionAnomalies(tx, ctx, { days: 30 }),
    );

    const skew = group(result, "clock-skew");
    expect(skew?.total).toBe(1);
    // The point of this screen: a row you can open, not just a number.
    expect(skew?.items[0]?.id).toBeTruthy();
  });

  it("lists revenue recorded with no currency", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { revenueCents: 4900, currency: null },
      { revenueCents: 4900, currency: "USD" },
      { revenueCents: null },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionAnomalies(tx, ctx, { days: 30 }),
    );

    expect(group(result, "revenue-without-currency")?.total).toBe(1);
  });

  it("reports a clean log as clean", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{ hoursAgo: 1 }, { hoursAgo: 3 }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionAnomalies(tx, ctx, { days: 30 }),
    );

    expect(result.data.affectedTotal).toBe(0);
    for (const entry of result.data.groups) {
      expect(entry.total).toBe(0);
      expect(entry.truncated).toBe(false);
    }
  });

  it("counts past the sample cap instead of reporting the sample size", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(
      tenantA,
      Array.from({ length: 30 }, () => ({ campaign: "{{campaign}}" })),
    );
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionAnomalies(tx, ctx, { days: 30 }),
    );

    const placeholders = group(result, "unrendered-placeholder");
    expect(placeholders?.total).toBe(30);
    expect(placeholders?.items).toHaveLength(result.data.sampleLimit);
    expect(placeholders?.truncated).toBe(true);
  });

  it("does not scan another tenant's log", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seed(tenantA, [{ campaign: "{{campaign}}" }]);
    await seed(
      tenantB,
      Array.from({ length: 4 }, () => ({ campaign: "{{campaign}}" })),
    );
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      getAttributionAnomalies(tx, ctx, { days: 30 }),
    );

    expect(group(result, "unrendered-placeholder")?.total).toBe(1);
  });
});
