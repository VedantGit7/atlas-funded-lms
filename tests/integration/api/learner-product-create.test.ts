import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  checkLearnerProductSlug,
  createBundle,
  getBundle,
} from "../../../backend/packages/domain/src/learner-products/learner-products.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Creating a product, and the slug check the form leans on.
 *
 * The interesting parts are database-shaped: the slug uniqueness index is per
 * tenant, so a clash names a row this tenant can already see, and create now
 * refuses references that do not resolve — the same check the contents editor
 * performs, applied at the point the bad reference would first be stored.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function insertCourse(tenant: IsolationTenantFixture, title: string): Promise<string> {
  const id = randomUUID();
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into courses (id, tenant_id, slug, title, status, created_at, updated_at)
      values (${id}::uuid, ${tenant.tenantId}::uuid, ${`course-${id.slice(0, 8)}`}, ${title},
              'DRAFT'::"PublishStatus", now(), now())
    `;
  });
  return id;
}

function bundleBody(slug: string, courseId: string, status = "DRAFT") {
  return {
    slug,
    title: "Complete trader bundle",
    description: "A comprehensive path.",
    status,
    items: [{ itemKind: "course", refId: courseId, position: 0 }],
  };
}

describeWithDb("creating a learner product (database)", () => {
  it("creates a bundle with its items in the given order", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const first = await insertCourse(tenantA, "Market Fundamentals");
    const second = await insertCourse(tenantA, "Technical Analysis");
    const ctx = tenantCtx(tenantA);
    const slug = `trader-bundle-${randomUUID().slice(0, 8)}`;

    const created = await withTenantTx(ctx, async (tx) =>
      createBundle(tx, ctx, {
        slug,
        title: "Complete trader bundle",
        status: "DRAFT",
        items: [
          { itemKind: "course", refId: second, position: 0 },
          { itemKind: "course", refId: first, position: 1 },
        ],
      }),
    );

    expect(created.data.slug).toBe(slug);
    expect(created.data.status).toBe("DRAFT");
    expect(created.data.items.map((item) => item.title)).toEqual([
      "Technical Analysis",
      "Market Fundamentals",
    ]);
  });

  it("refuses to store a reference that does not resolve", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);
    const ghost = randomUUID();
    const slug = `ghost-bundle-${randomUUID().slice(0, 8)}`;

    await expect(
      withTenantTx(ctx, async (tx) => createBundle(tx, ctx, bundleBody(slug, ghost))),
    ).rejects.toThrow(/do not exist in this school/);

    // The rejected create must not have left a half-built product behind.
    const check = await withTenantTx(ctx, async (tx) =>
      checkLearnerProductSlug(tx, ctx, { productKind: "bundle", slug }),
    );
    expect(check.data.available).toBe(true);
  });

  it("refuses a reference belonging to another tenant", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const foreign = await insertCourse(tenantB, "Another school's course");
    const ctx = tenantCtx(tenantA);

    await expect(
      withTenantTx(ctx, async (tx) =>
        createBundle(tx, ctx, bundleBody(`x-${randomUUID().slice(0, 8)}`, foreign)),
      ),
    ).rejects.toThrow(/do not exist in this school/);
  });

  it("rejects a slug already used in this tenant", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const course = await insertCourse(tenantA, "Market Fundamentals");
    const ctx = tenantCtx(tenantA);
    const slug = `taken-${randomUUID().slice(0, 8)}`;

    await withTenantTx(ctx, async (tx) => createBundle(tx, ctx, bundleBody(slug, course)));

    await expect(
      withTenantTx(ctx, async (tx) => createBundle(tx, ctx, bundleBody(slug, course))),
    ).rejects.toThrow(/slug already exists/i);
  });
});

describeWithDb("learner product slug check (database)", () => {
  it("reports a free slug as available", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      checkLearnerProductSlug(tx, ctx, { productKind: "bundle", slug: "nothing-holds-this" }),
    );

    expect(result.data.available).toBe(true);
    expect(result.data.conflict).toBeNull();
  });

  it("names the product holding a taken slug so the form can link to it", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const course = await insertCourse(tenantA, "Market Fundamentals");
    const ctx = tenantCtx(tenantA);
    const slug = `held-${randomUUID().slice(0, 8)}`;

    const created = await withTenantTx(ctx, async (tx) =>
      createBundle(tx, ctx, bundleBody(slug, course)),
    );

    const result = await withTenantTx(ctx, async (tx) =>
      checkLearnerProductSlug(tx, ctx, { productKind: "bundle", slug }),
    );

    expect(result.data.available).toBe(false);
    expect(result.data.conflict).toEqual({
      id: created.data.id,
      title: "Complete trader bundle",
    });
  });

  it("scopes the check to one product kind", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const course = await insertCourse(tenantA, "Market Fundamentals");
    const ctx = tenantCtx(tenantA);
    const slug = `shared-${randomUUID().slice(0, 8)}`;

    await withTenantTx(ctx, async (tx) => createBundle(tx, ctx, bundleBody(slug, course)));

    // Slugs are unique per table, so the same slug is still free for a mock test.
    const result = await withTenantTx(ctx, async (tx) =>
      checkLearnerProductSlug(tx, ctx, { productKind: "mock_test", slug }),
    );
    expect(result.data.available).toBe(true);
  });

  it("does not see a slug held in another tenant", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const course = await insertCourse(tenantB, "Their course");
    const slug = `theirs-${randomUUID().slice(0, 8)}`;

    await withTenantTx(tenantCtx(tenantB), async (tx) =>
      createBundle(tx, tenantCtx(tenantB), bundleBody(slug, course)),
    );

    // RLS scopes the lookup, and the unique index is (tenant_id, slug), so the
    // slug really is free here — reporting otherwise would leak the other
    // tenant's catalogue.
    const result = await withTenantTx(tenantCtx(tenantA), async (tx) =>
      checkLearnerProductSlug(tx, tenantCtx(tenantA), { productKind: "bundle", slug }),
    );
    expect(result.data.available).toBe(true);
    expect(result.data.conflict).toBeNull();
  });

  it("ignores a soft-deleted product's slug", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const course = await insertCourse(tenantA, "Market Fundamentals");
    const ctx = tenantCtx(tenantA);
    const slug = `recycled-${randomUUID().slice(0, 8)}`;

    const created = await withTenantTx(ctx, async (tx) =>
      createBundle(tx, ctx, bundleBody(slug, course)),
    );
    await withTenantTx(ctx, async (tx) => {
      await tx.$executeRaw`update bundles set deleted_at = now() where id = ${created.data.id}::uuid`;
    });

    const result = await withTenantTx(ctx, async (tx) =>
      checkLearnerProductSlug(tx, ctx, { productKind: "bundle", slug }),
    );
    expect(result.data.available).toBe(true);

    // And the detail route agrees the product is gone.
    await expect(
      withTenantTx(ctx, async (tx) => getBundle(tx, ctx, created.data.id)),
    ).rejects.toThrow(/Bundle not found/);
  });
});
