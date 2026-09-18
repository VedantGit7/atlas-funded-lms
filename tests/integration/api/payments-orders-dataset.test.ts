import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { buildReportDataset } from "@atlas/domain/reports/reports.datasets";
import { createPaymentExport } from "@atlas/domain/reports/payments-exports.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * The `orders` payments dataset.
 *
 * It reads the same table as `transactions`, so the only thing worth testing is
 * the part that differs: an order that never settled has no `paid_at`, and the
 * transactions view sorts and date-filters it by `coalesce(paid_at, created_at)`
 * — which makes it read as though it settled the day it was raised. The orders
 * view uses `created_at` throughout and can be narrowed to settled or unsettled.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function seedOrder(
  tenant: IsolationTenantFixture,
  args: { externalId: string; createdAt: string; paidAt: string | null; status?: string },
): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into payment_orders (
        id, tenant_id, membership_id, external_id, amount_cents, currency, status,
        paid_at, created_at, updated_at
      )
      values (
        ${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${tenant.membershipId}::uuid,
        ${args.externalId}, 1000, 'INR', ${args.status ?? "pending"},
        ${args.paidAt}::timestamptz, ${args.createdAt}::timestamptz, now()
      )
    `;
  });
}

function externalIds(result: { rows: Array<Record<string, unknown>> }): string[] {
  return result.rows.map((row) => String(row["external_id"]));
}

describeWithDb("payments orders dataset (database)", () => {
  it("orders by creation date, where transactions order by settlement date", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // Raised first, settled last.
    await seedOrder(tenantA, {
      externalId: "raised_first",
      createdAt: "2026-01-01T00:00:00.000Z",
      paidAt: "2026-06-01T00:00:00.000Z",
    });
    // Raised last, never settled — the row an operator is hunting for.
    await seedOrder(tenantA, {
      externalId: "raised_last_unsettled",
      createdAt: "2026-03-01T00:00:00.000Z",
      paidAt: null,
    });
    const ctx = tenantCtx(tenantA);

    const orders = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "payments",
        params: { reportTab: "orders", columns: ["external_id"] },
      }),
    );
    const transactions = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "payments",
        params: { reportTab: "transactions", columns: ["external_id"] },
      }),
    );

    expect(externalIds(orders)).toEqual(["raised_last_unsettled", "raised_first"]);
    // The settled-later order sorts first here purely because it settled later.
    expect(externalIds(transactions)).toEqual(["raised_first", "raised_last_unsettled"]);
  });

  it("narrows to unsettled orders", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedOrder(tenantA, {
      externalId: "settled",
      createdAt: "2026-01-01T00:00:00.000Z",
      paidAt: "2026-01-02T00:00:00.000Z",
      status: "paid",
    });
    await seedOrder(tenantA, {
      externalId: "unsettled",
      createdAt: "2026-01-03T00:00:00.000Z",
      paidAt: null,
    });
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "payments",
        params: { reportTab: "orders", settlement: "unsettled", columns: ["external_id"] },
      }),
    );

    expect(externalIds(result)).toEqual(["unsettled"]);
  });

  it("narrows to settled orders", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedOrder(tenantA, {
      externalId: "settled",
      createdAt: "2026-01-01T00:00:00.000Z",
      paidAt: "2026-01-02T00:00:00.000Z",
      status: "paid",
    });
    await seedOrder(tenantA, {
      externalId: "unsettled",
      createdAt: "2026-01-03T00:00:00.000Z",
      paidAt: null,
    });
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "payments",
        params: { reportTab: "orders", settlement: "settled", columns: ["external_id"] },
      }),
    );

    expect(externalIds(result)).toEqual(["settled"]);
  });

  it("ignores a settlement narrowing on the transactions view", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedOrder(tenantA, {
      externalId: "unsettled",
      createdAt: "2026-01-03T00:00:00.000Z",
      paidAt: null,
    });
    const ctx = tenantCtx(tenantA);

    // The API refuses this combination before it reaches the dataset; the query
    // still must not half-apply it if a stored schedule ever carries one.
    const result = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "payments",
        params: { reportTab: "transactions", settlement: "settled", columns: ["external_id"] },
      }),
    );

    expect(externalIds(result)).toEqual(["unsettled"]);
  });

  it("date-filters orders on creation, not settlement", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    // Created in January, settled in June.
    await seedOrder(tenantA, {
      externalId: "january_order",
      createdAt: "2026-01-15T00:00:00.000Z",
      paidAt: "2026-06-15T00:00:00.000Z",
      status: "paid",
    });
    const ctx = tenantCtx(tenantA);

    const januaryOrders = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "payments",
        params: {
          reportTab: "orders",
          startDate: "2026-01-01T00:00:00.000Z",
          endDate: "2026-01-31T23:59:59.999Z",
          columns: ["external_id"],
        },
      }),
    );
    const januaryTransactions = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "payments",
        params: {
          reportTab: "transactions",
          startDate: "2026-01-01T00:00:00.000Z",
          endDate: "2026-01-31T23:59:59.999Z",
          columns: ["external_id"],
        },
      }),
    );

    expect(externalIds(januaryOrders)).toEqual(["january_order"]);
    // Same row, same window, different axis — it settled in June.
    expect(externalIds(januaryTransactions)).toEqual([]);
  });

  it("can select the external id, which no payments export could before", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await seedOrder(tenantA, {
      externalId: "pay_abc123",
      createdAt: "2026-01-01T00:00:00.000Z",
      paidAt: null,
    });
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "payments",
        params: { reportTab: "orders", columns: ["id", "external_id"] },
      }),
    );

    expect(result.columns).toEqual(["id", "external_id"]);
    expect(result.rows[0]?.["external_id"]).toBe("pay_abc123");
  });

  it("does not read another tenant's orders", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await seedOrder(tenantA, {
      externalId: "tenant_a",
      createdAt: "2026-01-01T00:00:00.000Z",
      paidAt: null,
    });
    await seedOrder(tenantB, {
      externalId: "tenant_b",
      createdAt: "2026-01-02T00:00:00.000Z",
      paidAt: null,
    });
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      buildReportDataset(tx, {
        datasetKey: "payments",
        params: { reportTab: "orders", columns: ["external_id"] },
      }),
    );

    expect(externalIds(result)).toEqual(["tenant_a"]);
  });
});

describeWithDb("payments export settlement guard (database)", () => {
  it("refuses a settlement narrowing on a dataset that cannot honour it", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    // Accepting and dropping it would produce a file that looks like the
    // filtered one and is not.
    await expect(
      withTenantTx(ctx, async (tx) =>
        createPaymentExport(tx, ctx, {
          dataset: "transactions",
          columns: ["status"],
          format: "csv",
          settlement: "unsettled",
          useCurrentFilters: true,
          grouping: "none",
          includeSubtotals: false,
          delivery: "download",
          scheduleEnabled: false,
        }),
      ),
    ).rejects.toThrow(/orders dataset only/i);
  });
});
