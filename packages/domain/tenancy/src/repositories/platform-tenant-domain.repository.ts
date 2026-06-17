import type { PlatformTx } from "@atlas/db";

export async function insertFallbackTenantDomain(
  tx: PlatformTx,
  input: {
    tenantId: string;
    hostname: string;
  },
): Promise<{ id: string }> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO tenant_domains (
      id,
      tenant_id,
      hostname,
      type,
      status,
      is_primary,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      ${input.tenantId},
      ${input.hostname},
      'atlas_subdomain',
      'ACTIVE'::"DomainStatus",
      true,
      now(),
      now()
    )
    RETURNING id
  `;

  const row = rows[0];
  if (row === undefined) {
    throw new Error("Expected tenant domain insert to return id");
  }

  return row;
}
