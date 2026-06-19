import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { emptySeedResult, type SeedModule, type SeedResult } from "./types";

const COURSE_PUBLISH_WORKFLOW_DEFINITION = {
  key: "course.publish",
  name: "Course publish review",
  definitionJson: {
    targetType: "course",
    fromState: "DRAFT",
    reviewState: "REVIEW",
    approvedState: "PUBLISHED",
    rejectedState: "DRAFT",
    actions: ["approve", "reject", "return"],
  },
};

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

async function seedTenantWorkflowDefinition(tenantId: string): Promise<boolean> {
  return withTenantTx(
    {
      tenantId,
      requestId: "seed_workflows",
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      const existing = await tx.$queryRaw<Array<{ id: string }>>`
        select id::text
        from workflow_definitions
        where key = ${COURSE_PUBLISH_WORKFLOW_DEFINITION.key}
        limit 1
      `;

      if (existing.length > 0) {
        return false;
      }

      await tx.$executeRaw`
        insert into workflow_definitions (
          id,
          tenant_id,
          key,
          name,
          definition_json,
          status,
          created_at,
          updated_at
        )
        values (
          gen_random_uuid(),
          ${tenantId}::uuid,
          ${COURSE_PUBLISH_WORKFLOW_DEFINITION.key},
          ${COURSE_PUBLISH_WORKFLOW_DEFINITION.name},
          ${JSON.stringify(COURSE_PUBLISH_WORKFLOW_DEFINITION.definitionJson)}::jsonb,
          'ACTIVE',
          now(),
          now()
        )
      `;

      return true;
    },
  );
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
      const created = await seedTenantWorkflowDefinition(tenant.id);
      if (created) {
        inserted += 1;
      } else {
        skipped += 1;
      }
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
