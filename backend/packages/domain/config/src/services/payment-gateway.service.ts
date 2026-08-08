import type { TenantTx } from "@atlas/db";
import { findPaymentGateway } from "../schemas/payment-gateway-catalog";
import {
  findPaymentGatewayById,
  insertPaymentGateway,
  listPaymentGatewayRows,
  updatePaymentGatewayConfig,
  updatePaymentGatewayPublish,
  type PaymentGatewayRow,
} from "../repositories/payment-gateway.repository";
import { encryptPaymentSecret, secretLast4 } from "../payment-secret-crypto";
import type {
  PaymentGatewayListResponse,
  PaymentGatewayResponse,
  PaymentGatewayView,
  UpdatePaymentGatewayConfigRequest,
} from "../schemas/payment-gateway";

function toView(row: PaymentGatewayRow): PaymentGatewayView {
  return {
    id: row.id,
    gatewayKey: row.gateway_key,
    displayName: row.display_name,
    userId: row.user_id,
    publishableKey: row.publishable_key,
    billingLocationId: row.billing_location_id,
    hasSecret: row.has_secret,
    secretLast4: row.secret_last4,
    isDefault: row.is_default,
    isConfigured: row.is_configured,
    isPublished: row.is_published,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listPaymentGateways(tx: TenantTx): Promise<PaymentGatewayListResponse> {
  const rows = await listPaymentGatewayRows(tx);
  return { data: rows.map(toView) };
}

export async function addPaymentGateway(
  tx: TenantTx,
  gatewayKey: string,
): Promise<PaymentGatewayResponse> {
  const catalogEntry = findPaymentGateway(gatewayKey);
  if (!catalogEntry) {
    throw new Error("Unknown payment gateway.");
  }
  const row = await insertPaymentGateway(tx, {
    gatewayKey,
    displayName: catalogEntry.name,
  });
  return { data: toView(row) };
}

export class PaymentGatewayNotFoundError extends Error {
  constructor() {
    super("Payment gateway not found.");
    this.name = "PaymentGatewayNotFoundError";
  }
}

export async function getPaymentGateway(
  tx: TenantTx,
  id: string,
): Promise<PaymentGatewayResponse> {
  const row = await findPaymentGatewayById(tx, id);
  if (!row) {
    throw new PaymentGatewayNotFoundError();
  }
  return { data: toView(row) };
}

export async function configurePaymentGateway(
  tx: TenantTx,
  id: string,
  input: UpdatePaymentGatewayConfigRequest,
): Promise<PaymentGatewayResponse> {
  const existing = await findPaymentGatewayById(tx, id);
  if (!existing) {
    throw new PaymentGatewayNotFoundError();
  }

  // Encrypt the secret server-side; the plaintext never reaches the DB or client.
  const secret = input.secretKey
    ? { ciphertext: encryptPaymentSecret(input.secretKey), last4: secretLast4(input.secretKey) }
    : null;

  const hasSecret = secret !== null || existing.has_secret;
  const isConfigured =
    input.userId.length > 0 && input.publishableKey.length > 0 && hasSecret;

  await updatePaymentGatewayConfig(tx, {
    id,
    userId: input.userId,
    publishableKey: input.publishableKey,
    secret,
    billingLocationId: input.billingLocationId ?? null,
    isDefault: input.isDefault,
    isConfigured,
  });

  return getPaymentGateway(tx, id);
}

export async function publishPaymentGateway(
  tx: TenantTx,
  id: string,
  published: boolean,
): Promise<PaymentGatewayResponse> {
  const existing = await findPaymentGatewayById(tx, id);
  if (!existing) {
    throw new PaymentGatewayNotFoundError();
  }
  await updatePaymentGatewayPublish(tx, id, published);
  return getPaymentGateway(tx, id);
}
