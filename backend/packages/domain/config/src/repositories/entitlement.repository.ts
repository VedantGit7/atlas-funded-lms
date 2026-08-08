import type { TenantTx } from "@atlas/db";

export type ActiveEntitlementRow = {
  key: string;
  value: unknown;
  enabled: boolean;
  expires_at: Date | null;
};

function isEntitlementEnabled(value: unknown): boolean {
  return value !== false && value !== null;
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
