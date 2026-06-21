import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { listEffectiveFeatureFlags } from "../repositories/feature-flag.repository";
import type { FeatureFlagListResponse } from "../schemas/feature-flags";
import type { UpdateFeatureFlagRequest } from "../schemas/tenant-config";

const ENTITLEMENT_BACKED_FLAG_KEYS = new Set([
  "community.enable",
  "community.private_spaces.enable",
  "certification.enable",
  "gamification.enable",
  "branding.custom_domain.enable",
  "data.export.enable",
]);

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

export async function updateTenantFeatureFlagOverride(
  tx: TenantTx,
  ctx: {
    tenantId: string;
    actorMembershipId: string;
    requestId: string;
  },
  key: string,
  input: UpdateFeatureFlagRequest,
): Promise<FeatureFlagListResponse> {
  if (ENTITLEMENT_BACKED_FLAG_KEYS.has(key)) {
    throw new Error("FEATURE_FLAG_READ_ONLY");
  }

  const flagRows = await tx.$queryRaw<Array<{ id: string; key: string; default_value: unknown }>>`
    SELECT id, key, default_value
    FROM feature_flags
    WHERE key = ${key}
    LIMIT 1
  `;

  const flag = flagRows[0];
  if (!flag) {
    throw new Error("FEATURE_FLAG_NOT_FOUND");
  }

  await tx.$executeRaw`
    INSERT INTO feature_flag_overrides (
      id,
      tenant_id,
      feature_flag_id,
      value_json,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      app.current_tenant_id(),
      ${flag.id}::uuid,
      ${JSON.stringify(input.value)}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (tenant_id, feature_flag_id)
    DO UPDATE SET
      value_json = EXCLUDED.value_json,
      updated_at = now()
  `;

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "config.feature_flag.override_updated",
      target: { type: "feature_flag", id: flag.id },
      before: { key, defaultValue: flag.default_value },
      after: { key, value: input.value },
      reason: null,
      metadata: {},
    },
  );

  return listTenantFeatureFlags(tx);
}
