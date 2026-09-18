import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  exportAttributionEvents,
  listAttributionEvents,
} from "@atlas/domain/sales-marketing/sales-marketing.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Exporting the whole filtered attribution log.
 *
 * The log screen could previously only export the rows it had loaded — fifty at
 * a time — so a quarter of events meant pressing "Load more" until the whole
 * quarter was in the browser. The properties worth pinning are that the export
 * agrees with the log under the same filters, and that it never truncates
 * silently.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type SeedEvent = {
  eventType?: string;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
};

async function seed(tenant: IsolationTenantFixture, events: SeedEvent[]): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (const [index, event] of events.entries()) {
      await tx.$executeRaw`
        insert into sales_attribution_events (
          id, tenant_id, event_type, utm_source, utm_medium, utm_campaign, utm_term,
          occurred_at, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid, ${tenant.tenantId}::uuid,
          ${event.eventType ?? "page_view"},
          ${event.source === undefined ? "google" : event.source},
          ${event.medium === undefined ? "cpc" : event.medium},
          ${event.campaign === undefined ? "launch" : event.campaign},
          ${event.term ?? null},
          now() - make_interval(secs => ${index}), now(), now()
        )
      `;
    }
  });
}

describeWithDb("attribution export (database)", () => {
  it("returns every matching event, not just one page", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // More than the log's 50-row page size.
    await seed(
      tenantA,
      Array.from({ length: 60 }, () => ({})),
    );
    const ctx = tenantCtx(tenantA);

    const exported = await withTenantTx(ctx, async (tx) => exportAttributionEvents(tx, ctx, {}));

    expect(exported.data.items).toHaveLength(60);
    expect(exported.data.totalCount).toBe(60);
    expect(exported.data.truncated).toBe(false);
  });

  it("applies the same filters as the log", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      { eventType: "purchase" },
      { eventType: "purchase" },
      { eventType: "signup" },
      { eventType: "signup", source: null, medium: null, campaign: null },
    ]);
    const ctx = tenantCtx(tenantA);

    const exported = await withTenantTx(ctx, async (tx) =>
      exportAttributionEvents(tx, ctx, { eventType: "signup" }),
    );
    const listed = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { eventType: "signup", limit: 100 }),
    );

    // A file that disagrees with the screen it was exported from is worse than
    // no file at all.
    expect(exported.data.items.map((item) => item.id).sort()).toEqual(
      listed.data.items.map((item) => item.id).sort(),
    );
  });

  it("honours the attribution narrowing", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [
      {},
      { source: null, medium: null, campaign: null },
      // Attributed only by utm_term — the case the list DTO used to miss.
      { source: null, medium: null, campaign: null, term: "brand-search" },
    ]);
    const ctx = tenantCtx(tenantA);

    const none = await withTenantTx(ctx, async (tx) =>
      exportAttributionEvents(tx, ctx, { attribution: "none" }),
    );
    const attributed = await withTenantTx(ctx, async (tx) =>
      exportAttributionEvents(tx, ctx, { attribution: "attributed" }),
    );

    expect(none.data.totalCount).toBe(1);
    expect(attributed.data.totalCount).toBe(2);
  });

  it("orders newest first, matching the log", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(
      tenantA,
      Array.from({ length: 6 }, (_, index) => ({ eventType: `type_${String(index)}` })),
    );
    const ctx = tenantCtx(tenantA);

    const exported = await withTenantTx(ctx, async (tx) => exportAttributionEvents(tx, ctx, {}));
    const listed = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { limit: 100 }),
    );

    expect(exported.data.items.map((item) => item.id)).toEqual(
      listed.data.items.map((item) => item.id),
    );
  });

  it("carries all five UTM fields into the export", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{ term: "brand-search" }]);
    const ctx = tenantCtx(tenantA);

    const exported = await withTenantTx(ctx, async (tx) => exportAttributionEvents(tx, ctx, {}));

    expect(exported.data.items[0]?.utmTerm).toBe("brand-search");
  });

  it("reports the true total even when nothing matches", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, [{}, {}]);
    const ctx = tenantCtx(tenantA);

    const exported = await withTenantTx(ctx, async (tx) =>
      exportAttributionEvents(tx, ctx, { q: "matches-nothing" }),
    );

    expect(exported.data.items).toHaveLength(0);
    expect(exported.data.totalCount).toBe(0);
    expect(exported.data.truncated).toBe(false);
  });

  it("does not export another tenant's log", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seed(
      tenantA,
      Array.from({ length: 3 }, () => ({})),
    );
    await seed(
      tenantB,
      Array.from({ length: 7 }, () => ({})),
    );
    const ctx = tenantCtx(tenantA);

    const exported = await withTenantTx(ctx, async (tx) => exportAttributionEvents(tx, ctx, {}));

    expect(exported.data.items).toHaveLength(3);
    expect(exported.data.totalCount).toBe(3);
  });
});
