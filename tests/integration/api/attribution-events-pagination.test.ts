import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { listAttributionEvents } from "@atlas/domain/sales-marketing/sales-marketing.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Paging the attribution event log.
 *
 * The log orders by `occurred_at desc`, but its cursor compared `id`, and ids
 * are random v4 UUIDs. Comparing a random id against a time ordering drops rows
 * that happen to sort the wrong way — silently, and only from page two onward,
 * which is exactly where nobody checks.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function seed(tenant: IsolationTenantFixture, count: number): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (let index = 0; index < count; index += 1) {
      await tx.$executeRaw`
        insert into sales_attribution_events (
          id, tenant_id, event_type, utm_source, utm_medium, utm_campaign,
          occurred_at, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid, ${tenant.tenantId}::uuid, 'page_view',
          'google', 'cpc', 'launch',
          now() - (${index} * interval '1 minute'), now(), now()
        )
      `;
    }
  });
}

describeWithDb("attribution event pagination (database)", () => {
  it("walks every event exactly once", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, 12);
    const ctx = tenantCtx(tenantA);

    const seen: string[] = [];
    let cursor: string | undefined;
    // Small pages so the cursor is exercised repeatedly, as it is in the UI's
    // "Load more".
    for (let page = 0; page < 10; page += 1) {
      const result = await withTenantTx(ctx, async (tx) =>
        listAttributionEvents(tx, ctx, { limit: 4, ...(cursor ? { cursor } : {}) }),
      );
      seen.push(...result.data.items.map((item) => item.id));
      if (!result.data.pageInfo.hasNextPage) break;
      cursor = result.data.pageInfo.nextCursor ?? undefined;
      expect(cursor).toBeTruthy();
    }

    expect(seen).toHaveLength(12);
    expect(new Set(seen).size).toBe(12);
  });

  it("keeps newest-first order across the page boundary", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, 9);
    const ctx = tenantCtx(tenantA);

    const first = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { limit: 5 }),
    );
    const second = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, {
        limit: 5,
        cursor: first.data.pageInfo.nextCursor ?? "",
      }),
    );

    const times = [...first.data.items, ...second.data.items].map((item) =>
      Date.parse(item.occurredAt),
    );
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("treats a malformed cursor as the first page rather than failing", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seed(tenantA, 3);
    const ctx = tenantCtx(tenantA);

    // A cursor is opaque; a stale or hand-edited one must not 500 a read-only
    // log screen.
    const result = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { limit: 5, cursor: "not-a-real-cursor" }),
    );

    expect(result.data.items).toHaveLength(3);
  });

  it("does not page into another tenant's events", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seed(tenantA, 3);
    await seed(tenantB, 7);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      listAttributionEvents(tx, ctx, { limit: 50 }),
    );

    expect(result.data.items).toHaveLength(3);
  });
});
