import { describe, expect, it } from "vitest";
import { seedTenantAccessControl, TENANT_SYSTEM_ROLES } from "@atlas/access";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("access seed tenant isolation", () => {
  it("tenant role rows are visible only inside the matching tenant context", async () => {
    const fixture = await createTenantIsolationFixture();

    await seedTenantAccessControl({
      tenantId: fixture.tenantA.tenantId,
      requestId: "test_access_seed_tenant_a",
    });
    await seedTenantAccessControl({
      tenantId: fixture.tenantB.tenantId,
      requestId: "test_access_seed_tenant_b",
    });

    const rolesA = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ tenant_id: string; key: string }>>`
        select tenant_id::text, key
        from roles
        where deleted_at is null
        order by key asc
      `;
    });

    expect(rolesA).toHaveLength(TENANT_SYSTEM_ROLES.length);
    expect(rolesA.every((role) => role.tenant_id === fixture.tenantA.tenantId)).toBe(true);

    const rolesB = await withTenantTx(tenantCtx(fixture.tenantB), async (tx) => {
      return tx.$queryRaw<Array<{ tenant_id: string; key: string }>>`
        select tenant_id::text, key
        from roles
        where deleted_at is null
        order by key asc
      `;
    });

    expect(rolesB).toHaveLength(TENANT_SYSTEM_ROLES.length);
    expect(rolesB.every((role) => role.tenant_id === fixture.tenantB.tenantId)).toBe(true);
  });
});
