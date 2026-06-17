import { describe, expect, it } from "vitest";
import { PERMISSIONS, seedGlobalAccessCatalogue, seedTenantAccessControl } from "@atlas/access";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";

describe.sequential("access control seed idempotency", () => {
  it("can run global permission seed twice", async () => {
    await seedGlobalAccessCatalogue({
      requestId: "test_global_access_seed_once",
    });
    await seedGlobalAccessCatalogue({
      requestId: "test_global_access_seed_twice",
    });

    await withGlobalDb(async (db) => {
      const [countRow] = await db.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from permissions
      `;

      if (!countRow) {
        throw new Error("Expected permission count row");
      }

      expect(Number(countRow.count)).toBe(PERMISSIONS.length);
    });
  });

  it("can run tenant role seed twice without duplicates", async () => {
    await withGlobalDb(async (db) => {
      const [tenant] = await db.$queryRaw<Array<{ id: string }>>`
        select id::text
        from tenants
        where deleted_at is null
        order by created_at asc
        limit 1
      `;

      if (!tenant) {
        throw new Error("Expected at least one tenant");
      }

      await seedTenantAccessControl({
        tenantId: tenant.id,
        requestId: "test_access_seed_once",
      });

      await seedTenantAccessControl({
        tenantId: tenant.id,
        requestId: "test_access_seed_twice",
      });

      const roleCounts = await withTenantTx(
        {
          tenantId: tenant.id,
          requestId: "test_access_seed_role_counts",
          actorMembershipId: null,
          allowAnonymousTenantRead: true,
        },
        async (tx) => {
          return tx.$queryRaw<Array<{ key: string; count: bigint }>>`
            select r.key, count(*)::bigint as count
            from roles r
            where r.deleted_at is null
            group by r.key
            order by r.key asc
          `;
        },
      );

      expect(roleCounts.every((row) => Number(row.count) === 1)).toBe(true);
    });
  });
});
