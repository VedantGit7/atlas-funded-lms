import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  enrollBundle,
  listBundleEnrollments,
  updateProductEnrollments,
} from "../../../backend/packages/domain/src/learner-products/learner-products.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * The enrolment roster: filtering it, and changing it.
 *
 * Filtering is worth testing against the database because the count and the
 * page must apply the same predicates — a count that filters differently is a
 * pagination bug that only appears on the last page. Revocation is worth
 * testing because it must not delete the row: the audit entry recording who
 * granted access points at it.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function insertBundle(tenant: IsolationTenantFixture): Promise<string> {
  const id = randomUUID();
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into bundles (id, tenant_id, slug, title, status, created_at, updated_at)
      values (${id}::uuid, ${tenant.tenantId}::uuid, ${`bundle-${id.slice(0, 8)}`},
              'Complete trader bundle', 'PUBLISHED'::"PublishStatus", now(), now())
    `;
  });
  return id;
}

/** A membership with a profile and an email, so roster search has something to match. */
async function insertLearner(
  tenant: IsolationTenantFixture,
  displayName: string,
  email: string,
): Promise<string> {
  const membershipId = randomUUID();
  const principalId = randomUUID();
  // `auth_principals.email` is unique across the whole install, so fixtures in
  // different tests cannot share a literal address.
  const uniqueEmail = `${principalId.slice(0, 8)}.${email}`;
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into auth_principals (
        id, supabase_user_id, email, email_normalized, created_at, updated_at
      )
      values (${principalId}::uuid, ${randomUUID()}::uuid, ${uniqueEmail},
              ${uniqueEmail.toLowerCase()}, now(), now())
    `;
    await tx.$executeRaw`
      insert into memberships (id, tenant_id, auth_principal_id, status, created_at, updated_at)
      values (${membershipId}::uuid, ${tenant.tenantId}::uuid, ${principalId}::uuid,
              'ACTIVE'::"MembershipStatus", now(), now())
    `;
    await tx.$executeRaw`
      insert into member_profiles (id, tenant_id, membership_id, display_name, created_at, updated_at)
      values (${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${membershipId}::uuid,
              ${displayName}, now(), now())
    `;
  });
  return membershipId;
}

describeWithDb("enrolment roster filtering (database)", () => {
  it("matches a learner by name or email, and counts what it lists", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const bundleId = await insertBundle(tenantA);
    const ctx = tenantCtx(tenantA);

    const priya = await insertLearner(tenantA, "Priya Raghunathan", "priya@example.com");
    const marcus = await insertLearner(tenantA, "Marcus Johnson", "marcus@example.com");

    for (const membershipId of [priya, marcus]) {
      await withTenantTx(ctx, async (tx) =>
        enrollBundle(tx, ctx, bundleId, { membershipId, enrolledType: "free" }),
      );
    }

    const byName = await withTenantTx(ctx, async (tx) =>
      listBundleEnrollments(tx, ctx, bundleId, { q: "priya" }),
    );
    expect(byName.data.items).toHaveLength(1);
    // The count must agree with the page, or the pager lies.
    expect(byName.data.pageInfo.totalCount).toBe(1);

    const byEmail = await withTenantTx(ctx, async (tx) =>
      listBundleEnrollments(tx, ctx, bundleId, { q: "marcus@example" }),
    );
    expect(byEmail.data.items[0]?.membershipId).toBe(marcus);
  });

  it("filters by enrolment type and status", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const bundleId = await insertBundle(tenantA);
    const ctx = tenantCtx(tenantA);

    const free = await insertLearner(tenantA, "Free Learner", "free@example.com");
    const paid = await insertLearner(tenantA, "Paid Learner", "paid@example.com");

    await withTenantTx(ctx, async (tx) =>
      enrollBundle(tx, ctx, bundleId, { membershipId: free, enrolledType: "free" }),
    );
    const paidEnrolment = await withTenantTx(ctx, async (tx) =>
      enrollBundle(tx, ctx, bundleId, { membershipId: paid, enrolledType: "paid" }),
    );

    const byType = await withTenantTx(ctx, async (tx) =>
      listBundleEnrollments(tx, ctx, bundleId, { enrolledType: "paid" }),
    );
    expect(byType.data.items).toHaveLength(1);
    expect(byType.data.items[0]?.enrolledType).toBe("paid");

    await withTenantTx(ctx, async (tx) =>
      updateProductEnrollments(tx, ctx, {
        productKind: "bundle",
        productId: bundleId,
        enrollmentIds: [paidEnrolment.data.id],
        action: "revoke",
      }),
    );

    const active = await withTenantTx(ctx, async (tx) =>
      listBundleEnrollments(tx, ctx, bundleId, { status: "active" }),
    );
    expect(active.data.pageInfo.totalCount).toBe(1);
    expect(active.data.items[0]?.membershipId).toBe(free);
  });

  it("filters by the date the learner was enrolled", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const bundleId = await insertBundle(tenantA);
    const ctx = tenantCtx(tenantA);
    const learner = await insertLearner(tenantA, "Old Enrolment", "old@example.com");

    const enrolment = await withTenantTx(ctx, async (tx) =>
      enrollBundle(tx, ctx, bundleId, { membershipId: learner, enrolledType: "free" }),
    );
    await withTenantTx(ctx, async (tx) => {
      await tx.$executeRaw`
        update bundle_enrollments set enrolled_at = now() - interval '30 days'
        where id = ${enrolment.data.id}::uuid
      `;
    });

    const recent = await withTenantTx(ctx, async (tx) =>
      listBundleEnrollments(tx, ctx, bundleId, {
        enrolledFrom: new Date(Date.now() - 7 * 86_400_000).toISOString(),
      }),
    );
    expect(recent.data.pageInfo.totalCount).toBe(0);

    const older = await withTenantTx(ctx, async (tx) =>
      listBundleEnrollments(tx, ctx, bundleId, {
        enrolledFrom: new Date(Date.now() - 60 * 86_400_000).toISOString(),
      }),
    );
    expect(older.data.pageInfo.totalCount).toBe(1);
  });
});

describeWithDb("enrolment actions (database)", () => {
  async function seed(tenant: IsolationTenantFixture) {
    const bundleId = await insertBundle(tenant);
    const ctx = tenantCtx(tenant);
    const learner = await insertLearner(tenant, "Priya Raghunathan", "priya@example.com");
    const enrolment = await withTenantTx(ctx, async (tx) =>
      enrollBundle(tx, ctx, bundleId, { membershipId: learner, enrolledType: "free" }),
    );
    return { bundleId, ctx, enrollmentId: enrolment.data.id };
  }

  it("revokes without deleting the record of who granted access", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const { bundleId, ctx, enrollmentId } = await seed(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      updateProductEnrollments(tx, ctx, {
        productKind: "bundle",
        productId: bundleId,
        enrollmentIds: [enrollmentId],
        action: "revoke",
      }),
    );

    expect(result.data.updatedIds).toEqual([enrollmentId]);

    const roster = await withTenantTx(ctx, async (tx) =>
      listBundleEnrollments(tx, ctx, bundleId, {}),
    );
    // Still one row, now marked revoked — the audit entry points at it.
    expect(roster.data.pageInfo.totalCount).toBe(1);
    expect(roster.data.items[0]?.status).toBe("revoked");
  });

  it("restores a revoked enrolment", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const { bundleId, ctx, enrollmentId } = await seed(tenantA);

    for (const action of ["revoke", "restore"] as const) {
      await withTenantTx(ctx, async (tx) =>
        updateProductEnrollments(tx, ctx, {
          productKind: "bundle",
          productId: bundleId,
          enrollmentIds: [enrollmentId],
          action,
        }),
      );
    }

    const roster = await withTenantTx(ctx, async (tx) =>
      listBundleEnrollments(tx, ctx, bundleId, {}),
    );
    expect(roster.data.items[0]?.status).toBe("active");
  });

  it("sets and clears the expiry", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const { bundleId, ctx, enrollmentId } = await seed(tenantA);
    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();

    await withTenantTx(ctx, async (tx) =>
      updateProductEnrollments(tx, ctx, {
        productKind: "bundle",
        productId: bundleId,
        enrollmentIds: [enrollmentId],
        action: "set_expiry",
        expiresAt,
      }),
    );
    let roster = await withTenantTx(ctx, async (tx) =>
      listBundleEnrollments(tx, ctx, bundleId, {}),
    );
    expect(roster.data.items[0]?.expiresAt).not.toBeNull();

    await withTenantTx(ctx, async (tx) =>
      updateProductEnrollments(tx, ctx, {
        productKind: "bundle",
        productId: bundleId,
        enrollmentIds: [enrollmentId],
        action: "set_expiry",
        expiresAt: null,
      }),
    );
    roster = await withTenantTx(ctx, async (tx) => listBundleEnrollments(tx, ctx, bundleId, {}));
    expect(roster.data.items[0]?.expiresAt).toBeNull();
  });

  it("writes an audit entry per enrolment changed", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const { bundleId, ctx, enrollmentId } = await seed(tenantA);

    await withTenantTx(ctx, async (tx) =>
      updateProductEnrollments(tx, ctx, {
        productKind: "bundle",
        productId: bundleId,
        enrollmentIds: [enrollmentId],
        action: "revoke",
      }),
    );

    const audits = await withTenantTx(
      ctx,
      async (tx) =>
        tx.$queryRaw<Array<{ target_id: string }>>`
          select target_id from audit_entries
          where tenant_id = ${tenantA.tenantId}::uuid
            and action = 'learner_product.enrollment.revoked'
            and target_id = ${enrollmentId}
        `,
    );
    expect(audits).toHaveLength(1);
  });

  it("cannot reach an enrolment on a different product", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const first = await seed(tenantA);
    const otherBundle = await insertBundle(tenantA);

    // The enrolment id is real, but it belongs to the other bundle.
    const result = await withTenantTx(first.ctx, async (tx) =>
      updateProductEnrollments(tx, first.ctx, {
        productKind: "bundle",
        productId: otherBundle,
        enrollmentIds: [first.enrollmentId],
        action: "revoke",
      }),
    );

    expect(result.data.updatedIds).toEqual([]);
    expect(result.data.missingIds).toEqual([first.enrollmentId]);
  });

  it("404s for a product this tenant cannot see", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const foreign = await insertBundle(tenantB);
    const ctx = tenantCtx(tenantA);

    await expect(
      withTenantTx(ctx, async (tx) =>
        updateProductEnrollments(tx, ctx, {
          productKind: "bundle",
          productId: foreign,
          enrollmentIds: [randomUUID()],
          action: "revoke",
        }),
      ),
    ).rejects.toThrow(/Bundle not found/);
  });
});
