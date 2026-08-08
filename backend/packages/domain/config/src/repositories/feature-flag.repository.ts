import type { TenantTx } from "@atlas/db";
import {
  isEntitlementBackedFeatureFlagKey,
  resolveCanonicalFeatureFlagKey,
} from "../feature-flag-keys";

export type EffectiveFeatureFlagRow = {
  key: string;
  canonicalKey: string;
  description: string | null;
  value: unknown;
  source: "GLOBAL_DEFAULT" | "TENANT_OVERRIDE";
  read_only: boolean;
};

type RawFeatureFlagRow = {
  key: string;
  description: string | null;
  value: unknown;
  source: "GLOBAL_DEFAULT" | "TENANT_OVERRIDE";
};

function pickPreferredRow(rows: RawFeatureFlagRow[], canonicalKey: string): RawFeatureFlagRow {
  const exact = rows.find((row) => row.key === canonicalKey);
  if (exact) return exact;
  return [...rows].sort((a, b) => a.key.length - b.key.length)[0]!;
}

function dedupeFeatureFlagRows(rows: RawFeatureFlagRow[]): EffectiveFeatureFlagRow[] {
  const grouped = new Map<string, RawFeatureFlagRow[]>();

  for (const row of rows) {
    const canonicalKey = resolveCanonicalFeatureFlagKey(row.key);
    const bucket = grouped.get(canonicalKey) ?? [];
    bucket.push(row);
    grouped.set(canonicalKey, bucket);
  }

  return Array.from(grouped.entries()).map(([canonicalKey, bucket]) => {
    const preferred = pickPreferredRow(bucket, canonicalKey);
    return {
      key: preferred.key,
      canonicalKey,
      description: preferred.description,
      value: preferred.value,
      source: preferred.source,
      read_only: isEntitlementBackedFeatureFlagKey(preferred.key),
    };
  });
}

export async function listEffectiveFeatureFlags(tx: TenantTx): Promise<EffectiveFeatureFlagRow[]> {
  const rows = await tx.$queryRaw<RawFeatureFlagRow[]>`
    SELECT
      ff.key,
      ff.description,
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

  return dedupeFeatureFlagRows(rows).sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey));
}
