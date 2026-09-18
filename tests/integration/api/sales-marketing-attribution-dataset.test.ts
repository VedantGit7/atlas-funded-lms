import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { buildReportDataset } from "@atlas/domain/reports/reports.datasets";
import { createSalesMarketingExport } from "@atlas/domain/reports/sales-marketing-exports.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * The `attribution` sales & marketing export dataset.
 *
 * Every other dataset in this definition is a rollup; this one is the event
 * stream they are computed from. The properties worth pinning are the ones a
 * rollup cannot express: whether a row was attributed at all, and the
 * presence narrowing that turns the export into a list of untracked events.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type SeedEvent = {
  eventType?: string;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
  minutesAgo?: number;
};

async function seed(tenant: IsolationTenantFixture, events: SeedEvent[]): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (const [index, event] of events.entries()) {
      await tx.$executeRaw`
        insert into sales_attribution_events (
          id, tenant_id, event_type, utm_source, utm_medium, utm_campaign,
          utm_term, utm_content, occurred_at, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid, ${tenant.tenantId}::uuid,
          ${event.eventType ?? "page_view"},
          ${event.source === undefined ? "google" : event.source},
          ${event.medium === undefined ? "cpc" : event.medium},
          ${event.campaign === undefined ? "launch" : event.campaign},
          ${event.term ?? null}, ${event.content ?? null},
          now() - make_interval(mins => ${event.minutesAgo ?? index}), now(), now()
        )
      `;
    }
  });
}

function values(result: { rows: Array<Record<string, unknown>> }, column: string): unknown[] {
  return result.rows.map((row) => row[column]);
}

describeWithDb("sales & marketing attribution dataset (database)", () => {
  it("exports the raw event stream, newest first", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { eventType: "purchase", minutesAgo: 30 },
      { eventType: "signup", minutesAgo: 5 },
      { eventType: "page_view", minutesAgo: 60 },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "sales-marketing",
        params: { section: "attribution", columns: ["event_type"] },
      }),
    );

    expect(values(result, "event_type")).toEqual(["signup", "purchase", "page_view"]);
  });

  it("computes whether each event was attributed", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      {},
      { source: null, medium: null, campaign: null },
      // Attributed by `utm_content` alone — a field the log screen's row does
      // not even carry, which is why this is computed server side.
      { source: null, medium: null, campaign: null, content: "banner-a" },
    ]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "sales-marketing",
        params: { section: "attribution", columns: ["attributed", "utm_content"] },
      }),
    );

    expect(values(result, "attributed").sort()).toEqual(["no", "yes", "yes"]);
  });

  it("narrows to untracked events", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{}, {}, { source: null, medium: null, campaign: null }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "sales-marketing",
        params: { section: "attribution", attribution: "none", columns: ["attributed"] },
      }),
    );

    expect(values(result, "attributed")).toEqual(["no"]);
  });

  it("narrows to attributed events", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{}, { source: null, medium: null, campaign: null }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "sales-marketing",
        params: { section: "attribution", attribution: "attributed", columns: ["attributed"] },
      }),
    );

    expect(values(result, "attributed")).toEqual(["yes"]);
  });

  it("treats an explicit 'any' as no narrowing", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{}, { source: null, medium: null, campaign: null }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "sales-marketing",
        params: { section: "attribution", attribution: "any", columns: ["attributed"] },
      }),
    );

    expect(result.rows).toHaveLength(2);
  });

  it("bounds the window on the event date, not a purchase date", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{ minutesAgo: 1 }, { minutesAgo: 60 * 24 * 10 }]);
    const ctx = tenantCtx(tenantA);

    const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const result = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "sales-marketing",
        params: { section: "attribution", purchasedFrom: from, columns: ["event_type"] },
      }),
    );

    expect(result.rows).toHaveLength(1);
  });

  it("returns only the selected columns, in catalog order", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{}]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "sales-marketing",
        // Deliberately out of order: selecting is not reordering.
        params: { section: "attribution", columns: ["utm_source", "event_type"] },
      }),
    );

    expect(result.columns).toEqual(["event_type", "utm_source"]);
  });

  it("does not export another tenant's events", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seed(tenantA, [{ eventType: "tenant_a" }]);
    await seed(tenantB, [{ eventType: "tenant_b" }, { eventType: "tenant_b" }]);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "sales-marketing",
        params: { section: "attribution", columns: ["event_type"] },
      }),
    );

    expect(values(result, "event_type")).toEqual(["tenant_a"]);
  });
});

describeWithDb("sales & marketing attribution filter guard (database)", () => {
  it("refuses an attribution narrowing on a dataset that cannot honour it", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    // Accepting and dropping it would produce a file that looks like the
    // filtered one and is not.
    await expect(
      withTenantTx(ctx, async (tx) =>
        createSalesMarketingExport(tx, ctx, {
          dataset: "coupons",
          columns: ["code"],
          format: "csv",
          attribution: "none",
          grouping: "none",
          includeSubtotals: false,
          useCurrentFilters: true,
          delivery: "download",
          scheduleEnabled: false,
        }),
      ),
    ).rejects.toThrow(/attribution dataset only/i);
  });
});
