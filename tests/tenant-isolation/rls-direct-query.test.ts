import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";
import { withTenantTx } from "@atlas/db";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("RLS direct query isolation", () => {
  it("filters raw SELECT * to the current tenant only", async () => {
    const fixture = await createTenantIsolationFixture();

    const rows = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ tenant_id: string; slug: string }>>`
        SELECT tenant_id::text, slug
        FROM courses
        WHERE slug IN (${fixture.tenantA.courseSlug}, ${fixture.tenantB.courseSlug})
        ORDER BY slug
      `;
    });

    expect(rows).toEqual([
      {
        tenant_id: fixture.tenantA.tenantId,
        slug: fixture.tenantA.courseSlug,
      },
    ]);
  });

  it("returns zero rows for another tenant course ID", async () => {
    const fixture = await createTenantIsolationFixture();

    const rows = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text
        FROM courses
        WHERE id = ${fixture.tenantB.courseId}::uuid
      `;
    });

    expect(rows).toHaveLength(0);
  });

  it("blocks insert with mismatched tenant_id", async () => {
    const fixture = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
        await tx.$executeRaw`
          INSERT INTO courses (
            id,
            tenant_id,
            slug,
            title,
            status,
            created_by_membership_id,
            created_at,
            updated_at
          )
          VALUES (
            ${randomUUID()}::uuid,
            ${fixture.tenantB.tenantId}::uuid,
            'bad-cross-tenant-insert',
            'Bad Cross Tenant Insert',
            'DRAFT',
            ${fixture.tenantA.membershipId}::uuid,
            now(),
            now()
          )
        `;
      }),
    ).rejects.toThrow();
  });
});
