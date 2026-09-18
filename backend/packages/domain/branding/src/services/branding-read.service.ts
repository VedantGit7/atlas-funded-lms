import type { TenantTx } from "@atlas/db";
import { getTenantBranding, listTenantBrandingVersions } from "../repositories/branding.repository";
import type { TenantBrandingRow, TenantThemeRow } from "../repositories/types";
import { getTenantTheme, getLatestThemeVersionSnapshot } from "../repositories/theme.repository";
import { THEME_PRESETS } from "../utils/theme-presets";

/**
 * Tokens for a tenant with no saved branding yet.
 *
 * THEME_PRESETS is a non-empty literal, but indexing it yields `T | undefined`,
 * which the old `THEME_PRESETS[0]!` papered over. An empty catalogue would be a
 * build-time mistake, so fail loudly rather than render an untokenised shell.
 */
function defaultPresetTokens() {
  const preset = THEME_PRESETS[0];
  if (!preset) throw new Error("THEME_PRESETS is empty; no default branding tokens available.");
  return preset.tokens;
}

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

/**
 * `background` and `foreground` were removed from the theme token schema: they
 * only ever fed --tenant-background / --tenant-foreground, which no longer
 * paint anything.
 *
 * Rows written before that change still carry both keys, and the theme route
 * validates its own output against a `.strict()` schema -- so leaving them in
 * place turns every pre-existing tenant theme into a 500 on GET rather than a
 * cosmetic leftover. Rows self-heal on the next save, because the upsert writes
 * validated input; this keeps the read path working until then.
 */
const REMOVED_THEME_TOKEN_KEYS = new Set(["background", "foreground"]);

function stripRemovedThemeTokens<T>(tokens: T): T {
  if (tokens == null || typeof tokens !== "object") return tokens;
  return Object.fromEntries(
    Object.entries(tokens as Record<string, unknown>).filter(
      ([key]) => !REMOVED_THEME_TOKEN_KEYS.has(key),
    ),
  ) as T;
}

export function mapTheme(row: TenantThemeRow) {
  return {
    tenantId: row.tenant_id,
    tokens: stripRemovedThemeTokens(row.tokens_json),
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
  const publishedSnapshot = await getLatestThemeVersionSnapshot(tx);
  const row = await getTenantTheme(tx);

  if (!row) {
    const branding = await getTenantBranding(tx);
    if (!branding) throw new Error("THEME_NOT_FOUND");

    return {
      data: {
        tenantId: branding.tenant_id,
        tokens: defaultPresetTokens(),
        status: "DRAFT" as const,
        version: 0,
        updatedAt: branding.updated_at.toISOString(),
        publishedAt: null,
      },
      publishedBaselineTokens: stripRemovedThemeTokens(publishedSnapshot?.tokens_json ?? null),
    };
  }

  return {
    data: mapTheme(row),
    publishedBaselineTokens: stripRemovedThemeTokens(publishedSnapshot?.tokens_json ?? null),
  };
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
