import type { TenantTx } from "@atlas/db";
import type { DisabledTenantDomainRow, TenantDomainRow } from "./types";

export async function listTenantDomains(tx: TenantTx): Promise<TenantDomainRow[]> {
  return await tx.$queryRaw<TenantDomainRow[]>`
    SELECT
      id,
      hostname,
      type,
      status,
      is_primary,
      verification_txt_name,
      verification_txt_value,
      failure_reason,
      created_at,
      updated_at
    FROM tenant_domains
    WHERE tenant_id = app.current_tenant_id()
      AND deleted_at IS NULL
    ORDER BY is_primary DESC, created_at ASC
  `;
}

export async function findDomainByHostname(
  tx: TenantTx,
  hostname: string,
): Promise<Pick<TenantDomainRow, "id" | "hostname" | "status"> | null> {
  const rows = await tx.$queryRaw<Pick<TenantDomainRow, "id" | "hostname" | "status">[]>`
    SELECT id, hostname, status
    FROM tenant_domains
    WHERE hostname = ${hostname}
      AND deleted_at IS NULL
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function insertTenantDomain(
  tx: TenantTx,
  input: {
    hostname: string;
    type: "ATLAS_SUBDOMAIN" | "CUSTOM_DOMAIN";
    makePrimary: boolean;
    verificationTxtName: string | null;
    verificationTxtValue: string | null;
  },
): Promise<TenantDomainRow> {
  const rows = await tx.$queryRaw<TenantDomainRow[]>`
    INSERT INTO tenant_domains (
      id,
      tenant_id,
      hostname,
      type,
      status,
      is_primary,
      verification_txt_name,
      verification_txt_value,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      app.current_tenant_id(),
      ${input.hostname},
      ${input.type},
      CASE
        WHEN ${input.type} = 'ATLAS_SUBDOMAIN' THEN 'ACTIVE'::"DomainStatus"
        ELSE 'PENDING'::"DomainStatus"
      END,
      ${input.makePrimary},
      ${input.verificationTxtName},
      ${input.verificationTxtValue},
      now(),
      now()
    )
    RETURNING *
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("DOMAIN_INSERT_FAILED");
  }

  return row;
}

export async function disableTenantDomain(
  tx: TenantTx,
  domainId: string,
): Promise<DisabledTenantDomainRow | null> {
  const rows = await tx.$queryRaw<DisabledTenantDomainRow[]>`
    UPDATE tenant_domains
    SET status = 'DISABLED'::"DomainStatus",
        deleted_at = now(),
        updated_at = now()
    WHERE id = ${domainId}
      AND tenant_id = app.current_tenant_id()
      AND deleted_at IS NULL
    RETURNING id, status
  `;

  return rows[0] ?? null;
}
