import type { TenantTx } from "@atlas/db";
import type { UpdateTenantThemeRequest } from "../schemas/theme";
import { toJsonbLiteral } from "./json";
import type { TenantThemeRow } from "./types";

export async function getTenantTheme(tx: TenantTx): Promise<TenantThemeRow | null> {
  const rows = await tx.$queryRaw<TenantThemeRow[]>`
    SELECT
      tenant_id,
      tokens_json,
      status,
      version,
      updated_at,
      published_at
    FROM tenant_theme
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function upsertTenantThemeDraft(
  tx: TenantTx,
  input: UpdateTenantThemeRequest,
): Promise<TenantThemeRow> {
  const tokensLiteral = toJsonbLiteral(input.tokens);
  const rows = await tx.$queryRaw<TenantThemeRow[]>`
    INSERT INTO tenant_theme (
      id,
      tenant_id,
      primary_color,
      token_json,
      tokens_json,
      status,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      app.current_tenant_id(),
      ${input.tokens.primary},
      ${tokensLiteral}::jsonb,
      ${tokensLiteral}::jsonb,
      'DRAFT',
      now()
    )
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      tokens_json = EXCLUDED.tokens_json,
      status = 'DRAFT',
      updated_at = now()
    RETURNING *
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("THEME_UPSERT_FAILED");
  }

  return row;
}

export async function insertTenantThemeVersion(
  tx: TenantTx,
  args: {
    snapshot: unknown;
    publishedByMembershipId: string;
  },
): Promise<{ id: string; version: number }> {
  const snapshotLiteral = toJsonbLiteral(args.snapshot);
  const rows = await tx.$queryRaw<{ id: string; version: number }[]>`
    INSERT INTO tenant_theme_version (
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
    FROM tenant_theme_version
    WHERE tenant_id = app.current_tenant_id()
    RETURNING id, version
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("THEME_VERSION_INSERT_FAILED");
  }

  return row;
}

export async function getLatestThemeVersionSnapshot(tx: TenantTx): Promise<TenantThemeRow | null> {
  const rows = await tx.$queryRaw<{ snapshot_json: TenantThemeRow }[]>`
    SELECT snapshot_json
    FROM tenant_theme_version
    WHERE tenant_id = app.current_tenant_id()
    ORDER BY version DESC
    LIMIT 1
  `;

  return rows[0]?.snapshot_json ?? null;
}

export async function markThemePublished(tx: TenantTx, version: number): Promise<TenantThemeRow> {
  const rows = await tx.$queryRaw<TenantThemeRow[]>`
    UPDATE tenant_theme
    SET status = 'PUBLISHED',
        version = ${version},
        published_at = now(),
        updated_at = now()
    WHERE tenant_id = app.current_tenant_id()
    RETURNING *
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("THEME_PUBLISH_FAILED");
  }

  return row;
}
