import { createHash, randomBytes } from "node:crypto";
import type { PlatformTx } from "@atlas/db";
import { seedTenantDefaultWorkflowDefinitions } from "@atlas/db/seed/tenant-workflow-definitions";
import { seedTenantRolePermissions, seedTenantSystemRoles } from "@atlas/access";

export async function seedTenantSystemRolesFromCatalogue(
  tx: PlatformTx,
  args: { tenantId: string },
): Promise<void> {
  await seedTenantSystemRoles({ tx, tenantId: args.tenantId });
  await seedTenantRolePermissions({ tx, tenantId: args.tenantId });
}

export async function seedTenantWorkflowDefinitionsFromCatalogue(
  tx: PlatformTx,
  args: { tenantId: string },
): Promise<void> {
  await seedTenantDefaultWorkflowDefinitions({ tx, tenantId: args.tenantId });
}

export async function seedOwnerInvitationFromExistingHelper(
  tx: PlatformTx,
  args: {
    tenantId: string;
    email: string;
    displayName: string;
    requestId: string;
  },
): Promise<void> {
  const invitedEmailNormalized = args.email.trim().toLowerCase();
  const inviteToken = randomBytes(32).toString("base64url");
  const inviteTokenHash = createHash("sha256").update(inviteToken, "utf8").digest("hex");

  await tx.$executeRaw`
    INSERT INTO memberships (
      id,
      tenant_id,
      auth_principal_id,
      status,
      invited_email_normalized,
      invite_token_hash,
      invite_expires_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      ${args.tenantId},
      NULL,
      'INVITED',
      ${invitedEmailNormalized},
      ${inviteTokenHash},
      now() + interval '7 days',
      now(),
      now()
    )
  `;
}
