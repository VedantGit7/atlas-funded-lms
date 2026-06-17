import type { TenantTx } from "@atlas/db";

export type EffectiveFeatureFlagRow = {
  key: string;
  value: unknown;
  source: "GLOBAL_DEFAULT" | "TENANT_OVERRIDE";
  read_only: boolean;
};

const ENTITLEMENT_BACKED_FLAG_KEYS = new Set([
  "community.enable",
  "community.private_spaces.enable",
  "certification.enable",
  "gamification.enable",
  "branding.custom_domain.enable",
  "data.export.enable",
]);

export async function listEffectiveFeatureFlags(tx: TenantTx): Promise<EffectiveFeatureFlagRow[]> {
  const rows = await tx.$queryRaw<
    Array<{
      key: string;
      value: unknown;
      source: "GLOBAL_DEFAULT" | "TENANT_OVERRIDE";
    }>
  >`
    SELECT
      ff.key,
      COALESCE(ffo.value_json, ff.default_value) AS value,
      CASE
        WHEN ffo.id IS NULL THEN 'GLOBAL_DEFAULT'
        ELSE 'TENANT_OVERRIDE'
      END AS source
    FROM feature_flags ff
    LEFT JOIN feature_flag_overrides ffo
      ON ffo.feature_flag_id = ff.id
    ORDER BY ff.key ASC
  `;

  return rows.map((row) => ({
    key: row.key,
    value: row.value,
    source: row.source,
    read_only: ENTITLEMENT_BACKED_FLAG_KEYS.has(row.key),
  }));
}
