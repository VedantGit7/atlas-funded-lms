import type { TenantTx } from "@atlas/db";
import type { UpdateTenantBrandingRequest } from "../schemas/branding";
import { toJsonbLiteral } from "./json";
import type { TenantBrandingRow, TenantBrandingVersionRow } from "./types";

export async function getTenantBranding(tx: TenantTx): Promise<TenantBrandingRow | null> {
  const rows = await tx.$queryRaw<TenantBrandingRow[]>`
    SELECT
      tenant_id,
      display_name,
      public_name,
      logo_light_ref_id,
      logo_dark_ref_id,
      favicon_ref_id,
      issuer_name,
      public_landing_copy_json,
      status,
      version,
      updated_at,
      published_at
    FROM tenant_branding
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function upsertTenantBrandingDraft(
  tx: TenantTx,
  input: UpdateTenantBrandingRequest,
): Promise<TenantBrandingRow> {
  const publicLandingCopyLiteral = toJsonbLiteral(input.publicLandingCopy);
  const rows = await tx.$queryRaw<TenantBrandingRow[]>`
    INSERT INTO tenant_branding (
      id,
      tenant_id,
      display_name,
      public_name,
      logo_light_ref_id,
      logo_dark_ref_id,
      favicon_ref_id,
      issuer_name,
      public_landing_copy_json,
      status,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      app.current_tenant_id(),
      COALESCE(${input.publicName ?? null}, 'Atlas Tenant'),
      ${input.publicName ?? null},
      ${input.logoLight?.storageRefId ?? null},
      ${input.logoDark?.storageRefId ?? null},
      ${input.favicon?.storageRefId ?? null},
      ${input.issuerName ?? null},
      ${publicLandingCopyLiteral}::jsonb,
      'DRAFT',
      now()
    )
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      public_name = COALESCE(EXCLUDED.public_name, tenant_branding.public_name),
      logo_light_ref_id = COALESCE(EXCLUDED.logo_light_ref_id, tenant_branding.logo_light_ref_id),
      logo_dark_ref_id = COALESCE(EXCLUDED.logo_dark_ref_id, tenant_branding.logo_dark_ref_id),
      favicon_ref_id = COALESCE(EXCLUDED.favicon_ref_id, tenant_branding.favicon_ref_id),
      issuer_name = COALESCE(EXCLUDED.issuer_name, tenant_branding.issuer_name),
      public_landing_copy_json = COALESCE(EXCLUDED.public_landing_copy_json, tenant_branding.public_landing_copy_json),
      status = 'DRAFT',
      updated_at = now()
    RETURNING *
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("BRANDING_UPSERT_FAILED");
  }

  return row;
}

export async function insertTenantBrandingVersion(
  tx: TenantTx,
  args: {
    snapshot: unknown;
    publishedByMembershipId: string;
  },
): Promise<{ id: string; version: number }> {
  const snapshotLiteral = toJsonbLiteral(args.snapshot);
  const rows = await tx.$queryRaw<{ id: string; version: number }[]>`
    INSERT INTO tenant_branding_version (
      id,
      tenant_id,
      version,
      snapshot_json,
      published_by_membership_id,
      published_at
    )
    SELECT
      gen_random_uuid(),
      app.current_tenant_id(),
      COALESCE(MAX(version), 0) + 1,
      ${snapshotLiteral}::jsonb,
      ${args.publishedByMembershipId},
      now()
    FROM tenant_branding_version
    WHERE tenant_id = app.current_tenant_id()
    RETURNING id, version
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("BRANDING_VERSION_INSERT_FAILED");
  }

  return row;
}

export async function markBrandingPublished(
  tx: TenantTx,
  version: number,
): Promise<TenantBrandingRow> {
  const rows = await tx.$queryRaw<TenantBrandingRow[]>`
    UPDATE tenant_branding
    SET status = 'PUBLISHED',
        version = ${version},
        published_at = now(),
        updated_at = now()
    WHERE tenant_id = app.current_tenant_id()
    RETURNING *
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("BRANDING_PUBLISH_FAILED");
  }

  return row;
}

export async function listTenantBrandingVersions(
  tx: TenantTx,
): Promise<TenantBrandingVersionRow[]> {
  return await tx.$queryRaw<TenantBrandingVersionRow[]>`
    SELECT
      id,
      version,
      snapshot_json,
      published_by_membership_id,
      published_at
    FROM tenant_branding_version
    WHERE tenant_id = app.current_tenant_id()
    ORDER BY version DESC
    LIMIT 50
  `;
}
