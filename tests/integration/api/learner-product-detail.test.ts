import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  enrollBundle,
  getBundle,
  listBundleEnrollments,
} from "../../../backend/packages/domain/src/learner-products/learner-products.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Product detail against a real Postgres.
 *
 * The interesting behaviour is only true in the database: a bundle item stores
 * a `(kind, refId)` pointer and nothing else, so every title on the detail
 * screen comes from a join the service performs. A deleted reference has to
 * come back as `null` rather than vanishing from the list — an item that points
 * at nothing is exactly what an administrator needs to see before enrolling
 * someone into the bundle.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function insertBundle(tenant: IsolationTenantFixture): Promise<string> {
  const id = randomUUID();
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into bundles (id, tenant_id, slug, title, description, status, created_at, updated_at)
      values (${id}::uuid, ${tenant.tenantId}::uuid, ${`bundle-${id.slice(0, 8)}`},
              'Complete trader bundle', 'A comprehensive path for aspiring traders.',
              'DRAFT'::"PublishStatus", now(), now())
    `;
  });
  return id;
}

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

async function insertMockTest(tenant: IsolationTenantFixture, title: string): Promise<string> {
  const id = randomUUID();
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    // A mock test must name an assessment of its own tenant (audit M3).
    const assessmentId = randomUUID();
    await tx.$executeRaw`
      insert into assessments (id, tenant_id, slug, title, assessment_type, status, config_json, updated_at)
      values (${assessmentId}::uuid, ${tenant.tenantId}::uuid, ${`assessment-${assessmentId.slice(0, 8)}`},
              'Mock assessment', 'quiz', 'PUBLISHED'::"PublishStatus", '{}'::jsonb, now())
    `;
    await tx.$executeRaw`
      insert into mock_tests (id, tenant_id, slug, title, assessment_id, status, created_at, updated_at)
      values (${id}::uuid, ${tenant.tenantId}::uuid, ${`mock-${id.slice(0, 8)}`}, ${title},
              ${assessmentId}::uuid, 'PUBLISHED'::"PublishStatus", now(), now())
    `;
  });
  return id;
}

async function addBundleItem(
  tenant: IsolationTenantFixture,
  bundleId: string,
  itemKind: string,
  refId: string,
  position: number,
): Promise<void> {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into bundle_items (id, tenant_id, bundle_id, item_kind, ref_id, position, created_at)
      values (${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${bundleId}::uuid,
              ${itemKind}, ${refId}::uuid, ${position}, now())
    `;
  });
}

describeWithDb("learner product detail (database)", () => {
  it("resolves every item title through one batched lookup", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const bundleId = await insertBundle(tenantA);
    const courseId = await insertCourse(tenantA, "Market Fundamentals");
    const mockTestId = await insertMockTest(tenantA, "Risk desk mock 01");
    await addBundleItem(tenantA, bundleId, "course", courseId, 0);
    await addBundleItem(tenantA, bundleId, "mock_test", mockTestId, 1);

    const ctx = tenantCtx(tenantA);
    const result = await withTenantTx(ctx, async (tx) => getBundle(tx, ctx, bundleId));

    expect(result.data.title).toBe("Complete trader bundle");
    expect(result.data.items).toHaveLength(2);
    expect(result.data.items[0]).toMatchObject({
      itemKind: "course",
      refId: courseId,
      title: "Market Fundamentals",
      position: 0,
    });
    expect(result.data.items[1]).toMatchObject({
      itemKind: "mock_test",
      refId: mockTestId,
      title: "Risk desk mock 01",
    });
  });

  it("reports a deleted reference as a null title rather than dropping the item", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const bundleId = await insertBundle(tenantA);
    const liveCourse = await insertCourse(tenantA, "Technical Analysis");
    const doomedCourse = await insertCourse(tenantA, "Retired Course");
    await addBundleItem(tenantA, bundleId, "course", liveCourse, 0);
    await addBundleItem(tenantA, bundleId, "course", doomedCourse, 1);

    const ctx = tenantCtx(tenantA);
    await withTenantTx(ctx, async (tx) => {
      await tx.$executeRaw`update courses set deleted_at = now() where id = ${doomedCourse}::uuid`;
    });

    const result = await withTenantTx(ctx, async (tx) => getBundle(tx, ctx, bundleId));

    // The slot still exists in the bundle; only its target is gone.
    expect(result.data.items).toHaveLength(2);
    expect(result.data.items[0]?.title).toBe("Technical Analysis");
    expect(result.data.items[1]?.title).toBeNull();
    expect(result.data.items[1]?.refId).toBe(doomedCourse);
  });

  it("does not resolve a title across a tenant boundary", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const bundleId = await insertBundle(tenantA);
    const foreignCourse = await insertCourse(tenantB, "Another school's course");
    await addBundleItem(tenantA, bundleId, "course", foreignCourse, 0);

    const ctx = tenantCtx(tenantA);
    const result = await withTenantTx(ctx, async (tx) => getBundle(tx, ctx, bundleId));

    // RLS hides the row from the lookup, so the title is null and the other
    // tenant's course name never reaches this screen.
    expect(result.data.items[0]?.title).toBeNull();
  });

  it("404s for a product belonging to another tenant", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const foreignBundle = await insertBundle(tenantB);
    const ctx = tenantCtx(tenantA);

    await expect(
      withTenantTx(ctx, async (tx) => getBundle(tx, ctx, foreignBundle)),
    ).rejects.toThrow(/Bundle not found/);
  });

  it("lists who is enrolled, with their name and email", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const bundleId = await insertBundle(tenantA);
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) =>
      enrollBundle(tx, ctx, bundleId, {
        membershipId: tenantA.membershipId,
        enrolledType: "comp",
      }),
    );

    const roster = await withTenantTx(ctx, async (tx) =>
      listBundleEnrollments(tx, ctx, bundleId, {}),
    );

    expect(roster.data.pageInfo.totalCount).toBe(1);
    expect(roster.data.items[0]).toMatchObject({
      membershipId: tenantA.membershipId,
      enrolledType: "comp",
      status: "active",
    });
  });

  it("returns an empty roster for a product nobody is enrolled in", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const bundleId = await insertBundle(tenantA);
    const ctx = tenantCtx(tenantA);

    const roster = await withTenantTx(ctx, async (tx) =>
      listBundleEnrollments(tx, ctx, bundleId, {}),
    );

    expect(roster.data.items).toEqual([]);
    expect(roster.data.pageInfo.totalCount).toBe(0);
  });

  it("404s the roster of a product this tenant cannot see", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const foreignBundle = await insertBundle(tenantB);
    const ctx = tenantCtx(tenantA);

    await expect(
      withTenantTx(ctx, async (tx) => listBundleEnrollments(tx, ctx, foreignBundle, {})),
    ).rejects.toThrow(/Bundle not found/);
  });
});
