import { ROLE_PERMISSIONS, TENANT_SYSTEM_ROLES, seedTenantAccessControl } from "@atlas/access";
import { withGlobalDb } from "@atlas/db/global-db";
import { emptySeedResult, type SeedModule, type SeedResult } from "./types";

const ROLE_PERMISSION_GRANT_COUNT = Object.values(ROLE_PERMISSIONS).reduce(
  (total, permissions) => total + permissions.length,
  0,
);

async function listSeedableTenants(): Promise<Array<{ id: string }>> {
  return withGlobalDb(async (db) => {
    return db.$queryRaw<Array<{ id: string }>>`
      select id::text
      from tenants
      where deleted_at is null
        and state in ('PROVISIONING', 'ACTIVE')
      order by created_at asc
    `;
  });
}

export const rolesSeed: SeedModule = {
  name: "01-roles",
  groups: ["all", "catalogues"],
  async run(ctx): Promise<SeedResult> {
    if (ctx.mode === "dry-run") {
      ctx.log("[01-roles] dry-run only; no rows inserted");
      return emptySeedResult("01-roles");
    }

    const tenants = await listSeedableTenants();

    for (const tenant of tenants) {
      ctx.log(`[01-roles] seeding tenant roles for ${tenant.id}`);
      await seedTenantAccessControl({
        tenantId: tenant.id,
        requestId: "seed_access_control",
      });
    }

    const plannedRows = tenants.length * (TENANT_SYSTEM_ROLES.length + ROLE_PERMISSION_GRANT_COUNT);

    return {
      name: "01-roles",
      planned: plannedRows,
      inserted: plannedRows,
      updated: 0,
      skipped: 0,
    };
  },
};

export async function seedRolesForExistingTenants(): Promise<void> {
  const tenants = await listSeedableTenants();

  for (const tenant of tenants) {
    await seedTenantAccessControl({
      tenantId: tenant.id,
      requestId: "seed_access_control",
    });
  }
}
