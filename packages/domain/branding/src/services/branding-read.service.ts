import type { TenantTx } from "@atlas/db";
import { getTenantBranding, listTenantBrandingVersions } from "../repositories/branding.repository";
import type { TenantBrandingRow, TenantThemeRow } from "../repositories/types";
import { getTenantTheme } from "../repositories/theme.repository";

export function mapBranding(row: TenantBrandingRow) {
  return {
    tenantId: row.tenant_id,
    displayName: row.display_name,
    publicName: row.public_name,
    logoLight: row.logo_light_ref_id
      ? { storageRefId: row.logo_light_ref_id, altText: row.public_name ?? row.display_name }
      : null,
    logoDark: row.logo_dark_ref_id
      ? { storageRefId: row.logo_dark_ref_id, altText: row.public_name ?? row.display_name }
      : null,
    favicon: row.favicon_ref_id
      ? { storageRefId: row.favicon_ref_id, altText: row.public_name ?? row.display_name }
      : null,
    issuerName: row.issuer_name,
    publicLandingCopy: row.public_landing_copy_json,
    status: row.status,
    version: row.version ?? 0,
    updatedAt: row.updated_at.toISOString(),
    publishedAt: row.published_at?.toISOString() ?? null,
  };
}

export function mapTheme(row: TenantThemeRow) {
  return {
    tenantId: row.tenant_id,
    tokens: row.tokens_json,
    status: row.status,
    version: row.version ?? 0,
    updatedAt: row.updated_at.toISOString(),
    publishedAt: row.published_at?.toISOString() ?? null,
  };
}

export async function readTenantBranding(tx: TenantTx) {
  const row = await getTenantBranding(tx);
  if (!row) throw new Error("BRANDING_NOT_FOUND");

  return { data: mapBranding(row) };
}

export async function readTenantTheme(tx: TenantTx) {
  const row = await getTenantTheme(tx);
  if (!row) throw new Error("THEME_NOT_FOUND");

  return { data: mapTheme(row) };
}

export async function readTenantBrandingVersions(tx: TenantTx) {
  const rows = await listTenantBrandingVersions(tx);

  return {
    data: rows.map((row) => ({
      id: row.id,
      version: row.version,
      snapshot: row.snapshot_json,
      publishedByMembershipId: row.published_by_membership_id,
      publishedAt: row.published_at.toISOString(),
    })),
  };
}
