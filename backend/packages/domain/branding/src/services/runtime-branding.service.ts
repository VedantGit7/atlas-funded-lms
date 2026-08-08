import type { TenantTx } from "@atlas/db";
import type { RuntimeBrandingRow } from "../repositories/types";

export async function readRuntimeBrandingProjection(tx: TenantTx) {
  const rows = await tx.$queryRaw<RuntimeBrandingRow[]>`
    SELECT
      tb.public_name,
      tb.logo_light_ref_id,
      tb.logo_dark_ref_id,
      tb.favicon_ref_id,
      tb.issuer_name,
      tb.public_landing_copy_json,
      tt.tokens_json,
      tb.version AS branding_version,
      tt.version AS theme_version
    FROM tenant_branding tb
    LEFT JOIN tenant_theme tt
      ON tt.tenant_id = tb.tenant_id
    WHERE tb.tenant_id = app.current_tenant_id()
      AND tb.status = 'PUBLISHED'
      AND (tt.status = 'PUBLISHED' OR tt.status IS NULL)
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return {
      publicName: null,
      logoLightRefId: null,
      logoDarkRefId: null,
      faviconRefId: null,
      issuerName: null,
      publicLandingCopy: null,
      themeTokens: null,
      brandingVersion: 0,
      themeVersion: 0,
    };
  }

  return {
    publicName: row.public_name,
    logoLightRefId: row.logo_light_ref_id,
    logoDarkRefId: row.logo_dark_ref_id,
    faviconRefId: row.favicon_ref_id,
    issuerName: row.issuer_name,
    publicLandingCopy: row.public_landing_copy_json,
    themeTokens: row.tokens_json,
    brandingVersion: row.branding_version,
    themeVersion: row.theme_version,
  };
}
