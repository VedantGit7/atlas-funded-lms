import type { TenantTx } from "@atlas/db";
import { decryptPaymentSecret } from "@atlas/domain-config/payment-secret-crypto";
import { createRazorpayPaymentProvider } from "./adapters/razorpay.adapter";
import { createStripePaymentProvider } from "./adapters/stripe.adapter";
import type { PaymentProvider } from "./payment-provider";

type GatewaySecretRow = {
  id: string;
  gateway_key: string;
  publishable_key: string | null;
  secret_ciphertext: string | null;
  is_default: boolean;
  is_published: boolean;
  is_configured: boolean;
};

export class PaymentProviderNotConfiguredError extends Error {
  constructor(message = "No published default payment gateway is configured.") {
    super(message);
    this.name = "PaymentProviderNotConfiguredError";
  }
}

export class UnsupportedPaymentGatewayError extends Error {
  constructor(gatewayKey: string) {
    super(`Payment gateway "${gatewayKey}" is not supported yet.`);
    this.name = "UnsupportedPaymentGatewayError";
  }
}

async function loadGatewayRow(
  tx: TenantTx,
  gatewayKey?: string | null,
): Promise<GatewaySecretRow | null> {
  if (gatewayKey) {
    const byKey = await tx.$queryRaw<GatewaySecretRow[]>`
      select
        id::text,
        gateway_key,
        publishable_key,
        secret_ciphertext,
        is_default,
        is_published,
        is_configured
      from payment_gateways
      where gateway_key = ${gatewayKey}
        and is_published = true
        and is_configured = true
        and secret_ciphertext is not null
      order by is_default desc, updated_at desc
      limit 1
    `;
    if (byKey[0]) return byKey[0];
  }

  const defaults = await tx.$queryRaw<GatewaySecretRow[]>`
    select
      id::text,
      gateway_key,
      publishable_key,
      secret_ciphertext,
      is_default,
      is_published,
      is_configured
    from payment_gateways
    where is_default = true
      and is_published = true
      and is_configured = true
      and secret_ciphertext is not null
    order by updated_at desc
    limit 1
  `;
  if (defaults[0]) return defaults[0];

  const anyPublished = await tx.$queryRaw<GatewaySecretRow[]>`
    select
      id::text,
      gateway_key,
      publishable_key,
      secret_ciphertext,
      is_default,
      is_published,
      is_configured
    from payment_gateways
    where is_published = true
      and is_configured = true
      and secret_ciphertext is not null
    order by is_default desc, updated_at desc
    limit 1
  `;
  return anyPublished[0] ?? null;
}

function resolveStripeWebhookSecret(): string | null {
  const secret =
    process.env["STRIPE_WEBHOOK_SECRET"] ?? process.env["STRIPE_WEBHOOK_SIGNING_SECRET"] ?? "";
  const trimmed = secret.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveRazorpayWebhookSecret(): string | null {
  const secret = process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "";
  const trimmed = secret.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveWebhookSecretForGateway(gatewayKey: string): string | null {
  if (gatewayKey === "stripe") return resolveStripeWebhookSecret();
  if (gatewayKey === "razorpay") return resolveRazorpayWebhookSecret();
  return null;
}

export type ResolvedPaymentProvider = {
  provider: PaymentProvider;
  gatewayKey: string;
  gatewayId: string;
};

/**
 * Load the tenant's published default PaymentGateway and return a PaymentProvider adapter.
 */
export async function resolvePaymentProvider(
  tx: TenantTx,
  opts?: { gatewayKey?: string | null; requireWebhookSecret?: boolean },
): Promise<ResolvedPaymentProvider> {
  const row = await loadGatewayRow(tx, opts?.gatewayKey ?? null);
  if (!row?.secret_ciphertext) {
    throw new PaymentProviderNotConfiguredError();
  }

  const secretKey = decryptPaymentSecret(row.secret_ciphertext);
  const gatewayKey = row.gateway_key;
  const webhookSecret = resolveWebhookSecretForGateway(gatewayKey);

  if (opts?.requireWebhookSecret && !webhookSecret) {
    const envName = gatewayKey === "razorpay" ? "RAZORPAY_WEBHOOK_SECRET" : "STRIPE_WEBHOOK_SECRET";
    throw new PaymentProviderNotConfiguredError(
      `${envName} is not configured for webhook verification.`,
    );
  }

  if (gatewayKey === "stripe") {
    return {
      gatewayKey,
      gatewayId: row.id,
      provider: createStripePaymentProvider({
        secretKey,
        // Checkout does not need the webhook secret; parseWebhook validates when called.
        webhookSecret: webhookSecret ?? "",
      }),
    };
  }

  if (gatewayKey === "razorpay") {
    const keyId = row.publishable_key?.trim() ?? "";
    if (!keyId) {
      throw new PaymentProviderNotConfiguredError(
        "Razorpay Key ID (publishable key) is missing on the payment gateway.",
      );
    }
    return {
      gatewayKey,
      gatewayId: row.id,
      provider: createRazorpayPaymentProvider({
        keyId,
        secretKey,
        webhookSecret: webhookSecret ?? "",
      }),
    };
  }

  throw new UnsupportedPaymentGatewayError(gatewayKey);
}
