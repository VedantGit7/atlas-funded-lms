import type { TenantTx } from "@atlas/db";
import { listActiveEntitlements } from "../repositories/entitlement.repository";
import type { EntitlementListResponse } from "../schemas/entitlements";

export async function listTenantEntitlements(tx: TenantTx): Promise<EntitlementListResponse> {
  const rows = await listActiveEntitlements(tx);

  return {
    data: rows.map((row) => ({
      key: row.key,
      value: row.value,
      enabled: row.enabled,
      expiresAt: row.expires_at?.toISOString() ?? null,
    })),
  };
}
