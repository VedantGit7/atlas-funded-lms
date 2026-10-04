import { describe, expect, it } from "vitest";
import { createTenantIsolationFixture } from "../../tenant-isolation/tenant-isolation-fixture";
import { ROLE_PERMISSIONS, TENANT_SYSTEM_ROLES, seedTenantAccessControl } from "@atlas/access";
import { withTenantTx } from "@atlas/db/with-tenant-tx";

describe.sequential("tenant role seed", () => {
  it("seeds the approved tenant system roles and role permissions", async () => {
    // Its own tenant: relying on one left behind by other files made this depend
    // on file order, since their cleanup purges the tenants they created.
    const { tenantA } = await createTenantIsolationFixture();
    const tenant = { id: tenantA.tenantId };

    await seedTenantAccessControl({
      tenantId: tenant.id,
      requestId: "test_tenant_role_seed",
    });

    const roles = await withTenantTx(
      {
        tenantId: tenant.id,
        requestId: "test_tenant_role_seed_read",
        actorMembershipId: null,
        allowAnonymousTenantRead: true,
      },
      async (tx) => {
        return tx.$queryRaw<Array<{ key: string; is_system: boolean }>>`
          select key, is_system
          from roles
          where deleted_at is null
          order by key asc
        `;
      },
    );

    expect(roles.map((role) => role.key)).toEqual(
      TENANT_SYSTEM_ROLES.map((role) => role.key)
        .slice()
        .sort(),
    );
    expect(roles.every((role) => role.is_system)).toBe(true);

    const [{ ownerGrantCount }] = await withTenantTx(
      {
        tenantId: tenant.id,
        requestId: "test_tenant_role_seed_owner_grants",
        actorMembershipId: null,
        allowAnonymousTenantRead: true,
      },
      async (tx) => {
        return tx.$queryRaw<Array<{ ownerGrantCount: bigint }>>`
          select count(*)::bigint as "ownerGrantCount"
          from role_permissions rp
          join roles r on r.id = rp.role_id
          where rp.tenant_id = ${tenant.id}::uuid
            and r.key = 'owner'
            and r.deleted_at is null
        `;
      },
    );

    expect(Number(ownerGrantCount)).toBe(ROLE_PERMISSIONS.owner.length);
  });
});
