import type { TenantTx } from "@atlas/db";
import type { UpdateTenantConfigRequest } from "../schemas/tenant-config";

export type TenantConfigRow = {
  id: string;
  tenant_id: string;
  config_json: unknown;
  current_version_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function getTenantConfig(tx: TenantTx): Promise<TenantConfigRow | null> {
  const rows = await tx.$queryRaw<TenantConfigRow[]>`
    SELECT id, tenant_id, config_json, current_version_id, created_at, updated_at
    FROM tenant_config
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function upsertTenantConfigDraft(
  tx: TenantTx,
  input: UpdateTenantConfigRequest,
): Promise<TenantConfigRow> {
  const rows = await tx.$queryRaw<TenantConfigRow[]>`
    INSERT INTO tenant_config (
      id,
      tenant_id,
      config_json,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      app.current_tenant_id(),
      ${JSON.stringify(input.configJson)}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      config_json = EXCLUDED.config_json,
      updated_at = now()
    RETURNING id, tenant_id, config_json, current_version_id, created_at, updated_at
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("CONFIG_UPSERT_FAILED");
  }

  return row;
}

export async function insertTenantConfigVersion(
  tx: TenantTx,
  args: {
    snapshot: unknown;
    createdByMembershipId: string;
  },
): Promise<{ id: string; version: number }> {
  const rows = await tx.$queryRaw<Array<{ id: string; version: number }>>`
    INSERT INTO tenant_config_version (
      id,
      tenant_id,
      version,
      snapshot_json,
      created_by_membership_id,
      created_at
    )
    VALUES (
      gen_random_uuid(),
      app.current_tenant_id(),
      COALESCE(
        (SELECT MAX(version) + 1 FROM tenant_config_version WHERE tenant_id = app.current_tenant_id()),
        1
      ),
      ${JSON.stringify(args.snapshot)}::jsonb,
      ${args.createdByMembershipId}::uuid,
      now()
    )
    RETURNING id, version
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("CONFIG_VERSION_INSERT_FAILED");
  }

  return row;
}

export async function markTenantConfigPublished(
  tx: TenantTx,
  versionId: string,
): Promise<TenantConfigRow> {
  const rows = await tx.$queryRaw<TenantConfigRow[]>`
    UPDATE tenant_config
    SET current_version_id = ${versionId}::uuid, updated_at = now()
    RETURNING id, tenant_id, config_json, current_version_id, created_at, updated_at
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("CONFIG_PUBLISH_FAILED");
  }

  return row;
}
