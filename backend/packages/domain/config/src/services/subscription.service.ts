import type { TenantTx } from "@atlas/db";
import { listTenantSubscriptionRows } from "../repositories/subscription.repository";
import type { SubscriptionListResponse } from "../schemas/subscriptions";

function toIsoDateTime(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

export async function listTenantSubscriptions(tx: TenantTx): Promise<SubscriptionListResponse> {
  const rows = await listTenantSubscriptionRows(tx);

  return {
    data: rows.map((row) => ({
      id: String(row.id),
      planName: row.plan_name,
      currency: row.currency,
      status: row.status,
      durationType: row.duration_type,
      nextBillingAt: row.next_billing_at ? toIsoDateTime(row.next_billing_at) : null,
      createdAt: toIsoDateTime(row.created_at),
      updatedAt: toIsoDateTime(row.updated_at),
    })),
  };
}
