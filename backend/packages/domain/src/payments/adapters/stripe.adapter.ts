import Stripe from "stripe";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ParsedWebhook,
  PaymentProvider,
} from "../payment-provider";

export type StripeAdapterConfig = {
  secretKey: string;
  webhookSecret: string;
};

/**
 * Stripe SDK is confined to this adapter. Business logic must depend only on PaymentProvider.
 */
export function createStripePaymentProvider(config: StripeAdapterConfig): PaymentProvider {
  const stripe = new Stripe(config.secretKey, {
    apiVersion: "2026-07-29.dahlia",
  });

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

    parseWebhook(args: { rawBody: string; signature: string }): Promise<ParsedWebhook> {
      if (!config.webhookSecret) {
        throw new Error("STRIPE_WEBHOOK_SECRET is not configured for webhook verification.");
      }
      const event = stripe.webhooks.constructEvent(
        args.rawBody,
        args.signature,
        config.webhookSecret,
      );

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

    async refund(args: { externalId: string; amountCents?: number }) {
      // externalId may be a Checkout Session id — resolve PaymentIntent first.
      let paymentIntentId = args.externalId;
      if (args.externalId.startsWith("cs_")) {
        const session = await stripe.checkout.sessions.retrieve(args.externalId);
        if (!session.payment_intent) {
          throw new Error("Checkout session has no payment intent to refund.");
        }
        paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent.id;
      }

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        ...(args.amountCents != null ? { amount: args.amountCents } : {}),
      });

      return { refundId: refund.id };
    },
  };
}
