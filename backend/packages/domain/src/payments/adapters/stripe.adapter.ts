import Stripe from "stripe";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ParsedWebhook,
  PaymentProvider,
  RefundInput,
  RefundResult,
} from "../payment-provider";

export type StripeAdapterConfig = {
  secretKey: string;
  webhookSecret: string;
};

function paymentIntentId(refund: Stripe.Refund): string | null {
  return typeof refund.payment_intent === "string"
    ? refund.payment_intent
    : (refund.payment_intent?.id ?? null);
}

function normalizeRefund(refund: Stripe.Refund, externalId?: string): RefundResult {
  const sourceId =
    externalId ?? refund.metadata?.["atlasPaymentExternalId"] ?? paymentIntentId(refund);
  if (
    !refund.id ||
    !Number.isSafeInteger(refund.amount) ||
    refund.amount <= 0 ||
    typeof refund.currency !== "string" ||
    !/^[a-z]{3}$/i.test(refund.currency) ||
    !sourceId
  ) {
    throw new Error("Stripe returned an invalid refund record.");
  }
  return {
    refundId: refund.id,
    status:
      refund.status === "succeeded"
        ? "succeeded"
        : refund.status === "failed" || refund.status === "canceled"
          ? "failed"
          : "pending",
    amountCents: refund.amount,
    currency: refund.currency.toUpperCase(),
    externalId: sourceId,
    intentId: refund.metadata?.["atlasRefundIntentId"] ?? null,
  };
}

/**
 * Stripe SDK is confined to this adapter. Business logic must depend only on PaymentProvider.
 */
export function createStripePaymentProvider(config: StripeAdapterConfig): PaymentProvider {
  const stripe = new Stripe(config.secretKey, {
    apiVersion: "2026-07-29.dahlia",
    timeout: 20_000,
    maxNetworkRetries: 0,
  });

  async function resolvePaymentIntent(externalId: string): Promise<string> {
    if (!externalId.startsWith("cs_")) return externalId;
    const session = await stripe.checkout.sessions.retrieve(externalId);
    if (!session.payment_intent)
      throw new Error("Checkout session has no payment intent to refund.");
    return typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent.id;
  }

  return {
    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: input.amountCents,
              product_data: {
                name: input.courseTitle,
              },
            },
          },
        ],
        metadata: {
          paymentOrderId: input.paymentOrderId,
          tenantId: input.tenantId,
          ...input.metadata,
        },
        client_reference_id: input.paymentOrderId,
      });

      if (!session.url) {
        throw new Error("Stripe Checkout session did not return a URL.");
      }

      return {
        checkoutUrl: session.url,
        externalId: session.id,
        clientCheckout: null,
      };
    },

    async parseWebhook(args: { rawBody: string; signature: string }): Promise<ParsedWebhook> {
      if (!config.webhookSecret) {
        throw new Error("STRIPE_WEBHOOK_SECRET is not configured for webhook verification.");
      }
      const event = stripe.webhooks.constructEvent(
        args.rawBody,
        args.signature,
        config.webhookSecret,
      );

      if (
        event.type === "refund.created" ||
        event.type === "refund.updated" ||
        event.type === "refund.failed" ||
        event.type === "charge.refund.updated"
      ) {
        const refund = normalizeRefund(event.data.object);
        return {
          externalId: refund.externalId,
          paymentOrderId: null,
          status: "pending",
          rawType: event.type,
          refund,
        };
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const paymentOrderId =
          session.metadata?.["paymentOrderId"] ?? session.client_reference_id ?? null;
        const paid = session.payment_status === "paid" || session.status === "complete";
        return Promise.resolve({
          externalId: session.id,
          paymentOrderId,
          status: paid ? "paid" : "pending",
          rawType: event.type,
          amountCents: typeof session.amount_total === "number" ? session.amount_total : null,
          currency: session.currency ? session.currency.toUpperCase() : null,
        });
      }

      if (
        event.type === "checkout.session.expired" ||
        event.type === "payment_intent.payment_failed"
      ) {
        const obj = event.data.object as {
          id: string;
          metadata?: Record<string, string> | null;
        };
        return Promise.resolve({
          externalId: obj.id,
          paymentOrderId: obj.metadata?.["paymentOrderId"] ?? null,
          status: "failed",
          rawType: event.type,
        });
      }

      // Unhandled event types are treated as pending (no side effects).
      const obj = event.data.object as { id?: string; metadata?: Record<string, string> | null };
      return Promise.resolve({
        externalId: typeof obj.id === "string" ? obj.id : event.id,
        paymentOrderId: obj.metadata?.["paymentOrderId"] ?? null,
        status: "pending",
        rawType: event.type,
      });
    },

    async refund(args: RefundInput): Promise<RefundResult> {
      if (
        !Number.isSafeInteger(args.amountCents) ||
        args.amountCents <= 0 ||
        !args.intentId ||
        !args.idempotencyKey
      ) {
        throw new Error(
          "Refund requires an exact positive amount and durable intent/idempotency key.",
        );
      }
      const paymentIntent = await resolvePaymentIntent(args.externalId);
      const refund = await stripe.refunds.create(
        {
          payment_intent: paymentIntent,
          amount: args.amountCents,
          metadata: { atlasRefundIntentId: args.intentId, atlasPaymentExternalId: args.externalId },
        },
        { idempotencyKey: args.idempotencyKey, maxNetworkRetries: 0 },
      );
      if (paymentIntentId(refund) !== paymentIntent) {
        throw new Error("Stripe refund does not match the requested payment.");
      }
      return normalizeRefund(refund, args.externalId);
    },

    async findRefund(args): Promise<RefundResult | null> {
      const paymentIntent = await resolvePaymentIntent(args.externalId);
      const matches = (refund: Stripe.Refund) =>
        paymentIntentId(refund) === paymentIntent &&
        refund.metadata?.["atlasRefundIntentId"] === args.intentId;
      if (args.refundId) {
        const refund = await stripe.refunds.retrieve(args.refundId);
        return matches(refund) ? normalizeRefund(refund, args.externalId) : null;
      }
      // Bound provider I/O. A missing result remains ambiguous, never safe to resubmit.
      const refunds = await stripe.refunds.list({ payment_intent: paymentIntent, limit: 100 });
      const refund = refunds.data.find(matches);
      return refund ? normalizeRefund(refund, args.externalId) : null;
    },
  };
}
