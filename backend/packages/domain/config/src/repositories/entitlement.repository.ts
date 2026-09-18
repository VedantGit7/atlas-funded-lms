import type { TenantTx } from "@atlas/db";
import { parseEntitlementValue } from "../schemas/entitlement-value";

export type ActiveEntitlementRow = {
  key: string;
  value: unknown;
  enabled: boolean;
  expires_at: Date | null;
};

/**
 * M11. The old test was `value !== false && value !== null`, which treated any
 * object as enabled — including `{ "enabled": false }`, the exact shape a
 * quantitative entitlement uses to express "switched off". Parsing the value
 * properly is what makes the two forms safe to mix.
 */
function isEntitlementEnabled(value: unknown): boolean {
  return parseEntitlementValue(value).enabled;
}

export async function findActiveEntitlementByKey(
  tx: TenantTx,
  key: string,
): Promise<ActiveEntitlementRow | null> {
  const rows = await tx.$queryRaw<
    Array<{
      key: string;
      value: unknown;
      expires_at: Date | null;
    }>
  >`
    SELECT
      key,
      value_json AS value,
      expires_at
    FROM entitlements
    WHERE key = ${key}
      AND starts_at <= now()
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1
  `;

  const row = rows[0];

  if (!row || !isEntitlementEnabled(row.value)) {
    return null;
  }

  return {
    key: row.key,
    value: row.value,
    enabled: true,
    expires_at: row.expires_at,
  };
}

export async function listActiveEntitlements(tx: TenantTx): Promise<ActiveEntitlementRow[]> {
  const rows = await tx.$queryRaw<
    Array<{
      key: string;
      value: unknown;
      expires_at: Date | null;
    }>
  >`
    SELECT
      key,
      value_json AS value,
      expires_at
    FROM entitlements
    WHERE starts_at <= now()
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY key ASC
  `;

  return rows.map((row) => ({
    key: row.key,
    value: row.value,
    enabled: isEntitlementEnabled(row.value),
    expires_at: row.expires_at,
  }));
}
