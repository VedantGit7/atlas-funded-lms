export type CreateCheckoutInput = {
  tenantId: string;
  paymentOrderId: string;
  amountCents: number;
  currency: string;
  courseTitle: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
};

export type RazorpayClientCheckout = {
  provider: "razorpay";
  keyId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  name: string;
  description?: string;
  /**
   * Deprecated; always omitted. Checkout.js copies client notes onto the payment, so anything sent
   * here is attacker-controlled by the time it returns in a webhook (audit finding C1).
   */
  notes?: Record<string, string>;
};

export type CreateCheckoutResult = {
  externalId: string;
  /** Hosted checkout redirect (Stripe Checkout Sessions). */
  checkoutUrl?: string | null;
  /** Client-side Checkout.js payload (Razorpay Orders). */
  clientCheckout?: RazorpayClientCheckout | null;
};

export type ParsedWebhook = {
  /**
   * The gateway reference the server stored on `payment_orders.external_id` when it created the
   * checkout (Razorpay order id, Stripe Checkout Session id). This is the ONLY value that may
   * select the order to fulfil.
   */
  externalId: string;
  /**
   * Diagnostic only. Never use this to select or fulfil an order: on Razorpay it can originate
   * from checkout notes, which the browser controls (audit finding C1).
   */
  paymentOrderId: string | null;
  status: "paid" | "failed" | "pending";
  rawType: string;
  /** For `paid`: the captured amount in minor units, as reported by the gateway. */
  amountCents?: number | null;
  /** For `paid`: the captured currency (ISO 4217), as reported by the gateway. */
  currency?: string | null;
  refund?: RefundResult;
};

export type RefundInput = {
  externalId: string;
  amountCents: number;
  idempotencyKey: string;
  intentId: string;
};

export type RefundResult = {
  refundId: string;
  status: "pending" | "succeeded" | "failed";
  amountCents: number;
  currency: string;
  externalId: string;
  intentId: string | null;
};

export interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  parseWebhook(args: { rawBody: string; signature: string }): Promise<ParsedWebhook>;
  refund(args: RefundInput): Promise<RefundResult>;
  /** Read-only reconciliation. A missing match is never permission to repeat the refund POST. */
  findRefund?(args: {
    externalId: string;
    intentId: string;
    refundId?: string | null;
  }): Promise<RefundResult | null>;
}
