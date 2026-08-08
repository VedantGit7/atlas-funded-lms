import type { TenantTx } from "@atlas/db";

export type TenantSubscriptionRow = {
  id: string;
  plan_name: string;
  currency: string;
  status: string;
  duration_type: string;
  next_billing_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export async function listTenantSubscriptionRows(tx: TenantTx): Promise<TenantSubscriptionRow[]> {
  return tx.$queryRaw<TenantSubscriptionRow[]>`
    SELECT
      id,
      plan_name,
      currency,
      status,
      duration_type,
      next_billing_at,
      created_at,
      updated_at
    FROM tenant_subscriptions
    ORDER BY created_at DESC
  `;
}
