import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";
import { withPlatformScope, withTenantTx } from "@atlas/db";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("cross-tenant IDOR denial", () => {
  it("does not allow Tenant A to update Tenant B course by guessed ID", async () => {
    const fixture = await createTenantIsolationFixture();

    const updatedCount = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$executeRaw`
        UPDATE courses
        SET title = 'BAD CROSS TENANT UPDATE',
            updated_at = now()
        WHERE id = ${fixture.tenantB.courseId}::uuid
      `;
    });

    expect(Number(updatedCount)).toBe(0);

    const rows = await withPlatformScope(
      {
        principalId: randomUUID(),
        requestId: randomUUID(),
        requiredPermission: "platform.tenant.read",
        platformPermissions: ["platform.tenant.read"],
        tenantId: fixture.tenantB.tenantId,
        touchedTenantIds: [fixture.tenantB.tenantId],
      },
      "Verifying cross tenant update was blocked",
      async (tx) => {
        return tx.$queryRaw<Array<{ title: string }>>`
          SELECT title
          FROM courses
          WHERE id = ${fixture.tenantB.courseId}::uuid
        `;
      },
    );

    expect(rows[0]?.title).toBe(`Course ${fixture.tenantB.courseSlug}`);
  });

  it("does not allow Tenant A to delete Tenant B course by guessed ID", async () => {
    const fixture = await createTenantIsolationFixture();

    const deletedCount = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$executeRaw`
        DELETE FROM courses
        WHERE id = ${fixture.tenantB.courseId}::uuid
      `;
    });

    expect(Number(deletedCount)).toBe(0);

    const rows = await withPlatformScope(
      {
        principalId: randomUUID(),
        requestId: randomUUID(),
        requiredPermission: "platform.tenant.read",
        platformPermissions: ["platform.tenant.read"],
        tenantId: fixture.tenantB.tenantId,
        touchedTenantIds: [fixture.tenantB.tenantId],
      },
      "Verifying cross tenant delete was blocked",
      async (tx) => {
        return tx.$queryRaw<Array<{ id: string }>>`
          SELECT id::text
          FROM courses
          WHERE id = ${fixture.tenantB.courseId}::uuid
        `;
      },
    );

    expect(rows).toHaveLength(1);
  });

  it("does not expose Tenant B search entries to Tenant A", async () => {
    const fixture = await createTenantIsolationFixture();

    const rows = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ source_id: string; title: string }>>`
        SELECT source_id::text, title
        FROM search_index_entries
        WHERE source_id IN (${fixture.tenantA.courseId}::uuid, ${fixture.tenantB.courseId}::uuid)
        ORDER BY title
      `;
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.source_id).toBe(fixture.tenantA.courseId);
  });

  it("does not expose Tenant B community spaces to Tenant A", async () => {
    const fixture = await createTenantIsolationFixture();

    const rows = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ id: string; slug: string }>>`
        SELECT id::text, slug
        FROM community_spaces
        WHERE id IN (${fixture.tenantA.communitySpaceId}::uuid, ${fixture.tenantB.communitySpaceId}::uuid)
        ORDER BY slug
      `;
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(fixture.tenantA.communitySpaceId);
  });
});
