import { withPlatformScope } from "@atlas/db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  seedPermissions,
  seedTenantRolePermissions,
  seedTenantSystemRoles,
} from "./access-seed.repository";
import { validateAccessSeedData } from "./seed-validation";

const SYSTEM_CATALOGUE_SEED_PRINCIPAL_ID = "018f0000-0000-7000-8000-000000000099";

export async function seedGlobalAccessCatalogue(args: {
  requestId: string;
  principalId?: string;
}): Promise<void> {
  validateAccessSeedData();

  await withPlatformScope(
    {
      principalId: args.principalId ?? SYSTEM_CATALOGUE_SEED_PRINCIPAL_ID,
      requestId: args.requestId,
      requiredPermission: "platform.catalog.manage",
      platformPermissions: ["platform.catalog.manage"],
    },
    "Seeding global access permission catalogue",
    async (tx) => {
      await seedPermissions(tx);
    },
  );
}

export async function seedTenantAccessControl(args: {
  tenantId: string;
  requestId: string;
}): Promise<void> {
  validateAccessSeedData();

  await withTenantTx(
    {
      tenantId: args.tenantId,
      requestId: args.requestId,
      actorMembershipId: null,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      await seedTenantSystemRoles({ tx, tenantId: args.tenantId });
      await seedTenantRolePermissions({ tx, tenantId: args.tenantId });
    },
  );
}
