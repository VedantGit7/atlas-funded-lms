import type { TenantTx } from "@atlas/db";
import { findActiveEntitlementByKey } from "@atlas/domain-config";
import { EntitlementRequiredError } from "./entitlement-errors";

export async function enforceEntitlement(
  tx: TenantTx,
  args: {
    tenantId: string;
    key?: string | null;
    requestId: string;
    usageContext?: Record<string, unknown>;
  },
): Promise<void> {
  if (!args.key) {
    return;
  }

  if (!args.tenantId) {
    throw new EntitlementRequiredError(args.key);
  }

  const entitlement = await findActiveEntitlementByKey(tx, args.key);

  if (!entitlement) {
    throw new EntitlementRequiredError(args.key);
  }
}
