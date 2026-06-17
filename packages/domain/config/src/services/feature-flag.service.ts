import type { TenantTx } from "@atlas/db";
import { listEffectiveFeatureFlags } from "../repositories/feature-flag.repository";
import type { FeatureFlagListResponse } from "../schemas/feature-flags";

export async function listTenantFeatureFlags(tx: TenantTx): Promise<FeatureFlagListResponse> {
  const rows = await listEffectiveFeatureFlags(tx);

  return {
    data: rows.map((row) => ({
      key: row.key,
      value: row.value,
      source: row.source,
      readOnly: row.read_only,
    })),
  };
}
