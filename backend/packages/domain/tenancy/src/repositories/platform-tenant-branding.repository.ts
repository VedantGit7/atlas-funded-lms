import type { PlatformTx } from "@atlas/db";

/**
 * A new tenant's branding: a draft named after the tenant. Branding reads
 * expect the row (the security emails, the admin Branding and About pages),
 * and provisioning never wrote it, so a provisioned tenant failed them with
 * BRANDING_NOT_FOUND (staging, 30 October 2026). Migration 126 adds it for
 * tenants made before. The theme needs no row: reads fall back to the default
 * preset, and publishing writes it.
 */
export async function insertDefaultTenantBranding(
  tx: PlatformTx,
  input: {
    tenantId: string;
    displayName: string;
  },
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO tenant_branding (
      id,
      tenant_id,
      display_name,
      public_name,
      status,
      version,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      ${input.tenantId}::uuid,
      ${input.displayName},
      ${input.displayName},
      'DRAFT',
      0,
      now(),
      now()
    )
    ON CONFLICT (tenant_id) DO NOTHING
  `;
}
