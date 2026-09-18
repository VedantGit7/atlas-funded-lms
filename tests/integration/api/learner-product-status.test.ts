import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { updateLearnerProductStatuses } from "../../../backend/packages/domain/src/learner-products/learner-products.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * The catalogue publish/archive path against a real Postgres.
 *
 * The service is unit-tested with a stubbed repository and the route with a
 * stubbed service, so both prove the wiring and neither proves the SQL. What is
 * only true in the database: the `PublishStatus` enum cast, `= any($1::uuid[])`
 * over a set, `returning` reporting exactly the rows that moved, and — the one
 * that matters most — the `UPDATE` carrying no `tenant_id` predicate of its own
 * and relying entirely on the `FOR ALL` RLS policy to fence it.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type ProductTable = "mock_tests" | "test_series" | "bundles" | "learner_subscription_plans";

async function insertProduct(
  tenant: IsolationTenantFixture,
  table: ProductTable,
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED" = "DRAFT",
): Promise<{ id: string; slug: string }> {
  const id = randomUUID();
  const slug = `product-${randomUUID().slice(0, 8)}`;

  await withTenantTx(tenantCtx(tenant), async (tx) => {
    if (table === "mock_tests") {
      await tx.$executeRaw`
        insert into mock_tests (id, tenant_id, slug, title, assessment_id, status, created_at, updated_at)
        values (${id}::uuid, ${tenant.tenantId}::uuid, ${slug}, ${"Mock " + slug}, ${randomUUID()}::uuid,
                ${status}::"PublishStatus", now() - interval '1 day', now() - interval '1 day')
      `;
      return;
    }
    if (table === "test_series") {
      await tx.$executeRaw`
        insert into test_series (id, tenant_id, slug, title, status, created_at, updated_at)
        values (${id}::uuid, ${tenant.tenantId}::uuid, ${slug}, ${"Series " + slug},
                ${status}::"PublishStatus", now() - interval '1 day', now() - interval '1 day')
      `;
      return;
    }
    if (table === "bundles") {
      await tx.$executeRaw`
        insert into bundles (id, tenant_id, slug, title, status, created_at, updated_at)
        values (${id}::uuid, ${tenant.tenantId}::uuid, ${slug}, ${"Bundle " + slug},
                ${status}::"PublishStatus", now() - interval '1 day', now() - interval '1 day')
      `;
      return;
    }
    await tx.$executeRaw`
      insert into learner_subscription_plans (id, tenant_id, slug, title, billing_interval, status, created_at, updated_at)
      values (${id}::uuid, ${tenant.tenantId}::uuid, ${slug}, ${"Plan " + slug}, 'monthly',
              ${status}::"PublishStatus", now() - interval '1 day', now() - interval '1 day')
    `;
  });

  return { id, slug };
}

/** Reads as the given tenant, so RLS decides what is visible. */
async function readStatus(
  tenant: IsolationTenantFixture,
  table: ProductTable,
  productId: string,
): Promise<{ status: string; updatedAt: Date } | null> {
  return withTenantTx(tenantCtx(tenant), async (tx) => {
    const rows =
      table === "mock_tests"
        ? await tx.$queryRaw<Array<{ status: string; updated_at: Date }>>`
            select status, updated_at from mock_tests where id = ${productId}::uuid`
        : table === "test_series"
          ? await tx.$queryRaw<Array<{ status: string; updated_at: Date }>>`
            select status, updated_at from test_series where id = ${productId}::uuid`
          : table === "bundles"
            ? await tx.$queryRaw<Array<{ status: string; updated_at: Date }>>`
            select status, updated_at from bundles where id = ${productId}::uuid`
            : await tx.$queryRaw<Array<{ status: string; updated_at: Date }>>`
            select status, updated_at from learner_subscription_plans where id = ${productId}::uuid`;

    const row = rows[0];
    return row ? { status: row.status, updatedAt: row.updated_at } : null;
  });
}

describeWithDb("learner product status transitions (database)", () => {
  it.each([
    ["bundle", "bundles"],
    ["mock_test", "mock_tests"],
    ["test_series", "test_series"],
    ["subscription_plan", "learner_subscription_plans"],
  ] as const)("publishes a %s and bumps updated_at", async (productKind, table) => {
    const { tenantA } = await createTenantIsolationFixture();
    const product = await insertProduct(tenantA, table);
    const before = await readStatus(tenantA, table, product.id);

    const result = await withTenantTx(tenantCtx(tenantA), async (tx) =>
      updateLearnerProductStatuses(tx, tenantCtx(tenantA), {
        productKind,
        productIds: [product.id],
        status: "PUBLISHED",
      }),
    );

    expect(result.data.updated).toEqual([
      { id: product.id, slug: product.slug, previousStatus: "DRAFT", status: "PUBLISHED" },
    ]);
    expect(result.data.missingIds).toEqual([]);

    const after = await readStatus(tenantA, table, product.id);
    expect(after?.status).toBe("PUBLISHED");
    // The catalogue list is ordered by updated_at, so a transition that does not
    // move it would leave a freshly published product buried down the page.
    expect(after?.updatedAt.getTime()).toBeGreaterThan(before?.updatedAt.getTime() ?? 0);
  });

  it("moves a whole selection in one statement and audits each row", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const first = await insertProduct(tenantA, "bundles", "DRAFT");
    const second = await insertProduct(tenantA, "bundles", "PUBLISHED");
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      updateLearnerProductStatuses(tx, ctx, {
        productKind: "bundle",
        productIds: [first.id, second.id],
        status: "ARCHIVED",
      }),
    );

    expect(result.data.updated).toHaveLength(2);
    expect(
      result.data.updated
        .map((row) => [row.id, row.previousStatus])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toEqual(
      [
        [first.id, "DRAFT"],
        [second.id, "PUBLISHED"],
      ].sort((a, b) => a[0].localeCompare(b[0])),
    );

    // `audit_entries.target_id` is text, not uuid — targets are not all rows.
    const audits = await withTenantTx(
      ctx,
      async (tx) =>
        tx.$queryRaw<Array<{ target_id: string; before_json: unknown; after_json: unknown }>>`
        select target_id, before_json, after_json
        from audit_entries
        where tenant_id = ${tenantA.tenantId}::uuid
          and action = 'learner_product.bundle.status_changed'
          and target_id = any(${[first.id, second.id]}::text[])
        order by target_id
      `,
    );

    expect(audits).toHaveLength(2);
    const byId = new Map(audits.map((row) => [row.target_id, row]));
    expect(byId.get(first.id)?.before_json).toEqual({ status: "DRAFT" });
    expect(byId.get(first.id)?.after_json).toEqual({ status: "ARCHIVED" });
    expect(byId.get(second.id)?.before_json).toEqual({ status: "PUBLISHED" });
  });

  it("cannot touch another tenant's product, and reports it as missing", async () => {
    // The UPDATE names no tenant_id; this is the test that the RLS policy is
    // what makes that safe. If the policy were ever weakened to SELECT-only,
    // this is the assertion that fails.
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const mine = await insertProduct(tenantA, "bundles", "DRAFT");
    const theirs = await insertProduct(tenantB, "bundles", "DRAFT");
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      updateLearnerProductStatuses(tx, ctx, {
        productKind: "bundle",
        productIds: [mine.id, theirs.id],
        status: "PUBLISHED",
      }),
    );

    expect(result.data.updated.map((row) => row.id)).toEqual([mine.id]);
    expect(result.data.missingIds).toEqual([theirs.id]);

    expect((await readStatus(tenantA, "bundles", mine.id))?.status).toBe("PUBLISHED");
    expect((await readStatus(tenantB, "bundles", theirs.id))?.status).toBe("DRAFT");
    // Nothing about the other tenant's row leaked into this tenant's audit log.
    expect(await readStatus(tenantA, "bundles", theirs.id)).toBeNull();
  });

  it("skips a soft-deleted product rather than resurrecting it", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const product = await insertProduct(tenantA, "bundles", "DRAFT");
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) => {
      await tx.$executeRaw`update bundles set deleted_at = now() where id = ${product.id}::uuid`;
    });

    const result = await withTenantTx(ctx, async (tx) =>
      updateLearnerProductStatuses(tx, ctx, {
        productKind: "bundle",
        productIds: [product.id],
        status: "PUBLISHED",
      }),
    );

    expect(result.data.updated).toEqual([]);
    expect(result.data.missingIds).toEqual([product.id]);
    expect((await readStatus(tenantA, "bundles", product.id))?.status).toBe("DRAFT");
  });

  it("rolls the whole batch back when the transaction fails", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const product = await insertProduct(tenantA, "bundles", "DRAFT");
    const ctx = tenantCtx(tenantA);

    await expect(
      withTenantTx(ctx, async (tx) => {
        await updateLearnerProductStatuses(tx, ctx, {
          productKind: "bundle",
          productIds: [product.id],
          status: "PUBLISHED",
        });
        throw new Error("caller failed after the update");
      }),
    ).rejects.toThrow("caller failed after the update");

    // Publishing twenty-five rows either happens or does not; this is the half
    // of that promise the single-transaction design exists for.
    expect((await readStatus(tenantA, "bundles", product.id))?.status).toBe("DRAFT");
  });
});
