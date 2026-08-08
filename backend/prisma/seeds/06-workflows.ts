import { withGlobalDb } from "@atlas/db/global-db";
import { seedTenantDefaultWorkflowDefinitions } from "@atlas/db/seed/tenant-workflow-definitions";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { emptySeedResult, type SeedModule, type SeedResult } from "./types";

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

export const workflowsSeed: SeedModule = {
  name: "06-workflows",
  groups: ["all", "catalogues", "tenants"],
  async run(ctx): Promise<SeedResult> {
    if (ctx.mode === "dry-run") {
      ctx.log("[06-workflows] dry-run only; no rows inserted");
      return emptySeedResult("06-workflows");
    }

    const tenants = await listSeedableTenants();
    let inserted = 0;
    let skipped = 0;

    for (const tenant of tenants) {
      ctx.log(`[06-workflows] seeding workflow definitions for ${tenant.id}`);
      const result = await withTenantTx(
        {
          tenantId: tenant.id,
          requestId: "seed_workflows",
          allowAnonymousTenantRead: true,
        },
        async (tx) => seedTenantDefaultWorkflowDefinitions({ tx, tenantId: tenant.id }),
      );
      inserted += result.inserted;
      skipped += result.skipped;
    }

    return {
      name: "06-workflows",
      planned: tenants.length,
      inserted,
      updated: 0,
      skipped,
    };
  },
};
