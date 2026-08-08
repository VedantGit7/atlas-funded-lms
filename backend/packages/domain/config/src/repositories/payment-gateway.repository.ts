import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type PaymentGatewayRow = {
  id: string;
  gateway_key: string;
  display_name: string;
  user_id: string | null;
  publishable_key: string | null;
  secret_last4: string | null;
  has_secret: boolean;
  billing_location_id: string | null;
  is_default: boolean;
  is_configured: boolean;
  is_published: boolean;
  updated_at: Date;
};

export async function listPaymentGatewayRows(tx: TenantTx): Promise<PaymentGatewayRow[]> {
  return tx.$queryRaw<PaymentGatewayRow[]>`
    SELECT
      id::text,
      gateway_key,
      display_name,
      user_id,
      publishable_key,
      secret_last4,
      (secret_ciphertext IS NOT NULL) AS has_secret,
      billing_location_id::text,
      is_default,
      is_configured,
      is_published,
      updated_at
    FROM payment_gateways
    ORDER BY is_default DESC, display_name ASC
  `;
}

export async function findPaymentGatewayByKey(
  tx: TenantTx,
  gatewayKey: string,
): Promise<PaymentGatewayRow | null> {
  const rows = await tx.$queryRaw<PaymentGatewayRow[]>`
    SELECT
      id::text,
      gateway_key,
      display_name,
      user_id,
      publishable_key,
      secret_last4,
      (secret_ciphertext IS NOT NULL) AS has_secret,
      billing_location_id::text,
      is_default,
      is_configured,
      is_published,
      updated_at
    FROM payment_gateways
    WHERE gateway_key = ${gatewayKey}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function findPaymentGatewayById(
  tx: TenantTx,
  id: string,
): Promise<PaymentGatewayRow | null> {
  const rows = await tx.$queryRaw<PaymentGatewayRow[]>`
    SELECT
      id::text,
      gateway_key,
      display_name,
      user_id,
      publishable_key,
      secret_last4,
      (secret_ciphertext IS NOT NULL) AS has_secret,
      billing_location_id::text,
      is_default,
      is_configured,
      is_published,
      updated_at
    FROM payment_gateways
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export type PaymentGatewayConfigUpdate = {
  id: string;
  userId: string;
  publishableKey: string;
  /** New encrypted secret + last4, or null to leave the existing secret untouched. */
  secret: { ciphertext: string; last4: string } | null;
  billingLocationId: string | null;
  isDefault: boolean;
  isConfigured: boolean;
};

export async function updatePaymentGatewayConfig(
  tx: TenantTx,
  update: PaymentGatewayConfigUpdate,
): Promise<void> {
  if (update.isDefault) {
    // Only one default per tenant (RLS scopes this to the current tenant).
    await tx.$executeRaw`
      UPDATE payment_gateways SET is_default = false, updated_at = now()
      WHERE id <> ${update.id}::uuid AND is_default = true
    `;
  }

  if (update.secret) {
    await tx.$executeRaw`
      UPDATE payment_gateways
      SET user_id = ${update.userId},
          publishable_key = ${update.publishableKey},
          secret_ciphertext = ${update.secret.ciphertext},
          secret_last4 = ${update.secret.last4},
          billing_location_id = ${update.billingLocationId ? update.billingLocationId : null}::uuid,
          is_default = ${update.isDefault},
          is_configured = ${update.isConfigured},
          updated_at = now()
      WHERE id = ${update.id}::uuid
    `;
  } else {
    await tx.$executeRaw`
      UPDATE payment_gateways
      SET user_id = ${update.userId},
          publishable_key = ${update.publishableKey},
          billing_location_id = ${update.billingLocationId ? update.billingLocationId : null}::uuid,
          is_default = ${update.isDefault},
          is_configured = ${update.isConfigured},
          updated_at = now()
      WHERE id = ${update.id}::uuid
    `;
  }
}

export async function updatePaymentGatewayPublish(
  tx: TenantTx,
  id: string,
  published: boolean,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE payment_gateways
    SET is_published = ${published}, updated_at = now()
    WHERE id = ${id}::uuid
  `;
}

export async function insertPaymentGateway(
  tx: TenantTx,
  args: { gatewayKey: string; displayName: string },
): Promise<PaymentGatewayRow> {
  const id = randomUUID();
  await tx.$executeRaw`
    INSERT INTO payment_gateways (id, tenant_id, gateway_key, display_name, updated_at)
    VALUES (
      ${id}::uuid,
      current_setting('app.tenant_id')::uuid,
      ${args.gatewayKey},
      ${args.displayName},
      now()
    )
    ON CONFLICT (tenant_id, gateway_key) DO NOTHING
  `;
  const row = await findPaymentGatewayByKey(tx, args.gatewayKey);
  if (!row) {
    throw new Error("Failed to add payment gateway.");
  }
  return row;
}
