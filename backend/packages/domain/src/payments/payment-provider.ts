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
  externalId: string;
  paymentOrderId: string | null;
  status: "paid" | "failed" | "pending";
  rawType: string;
};

export interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  parseWebhook(args: { rawBody: string; signature: string }): Promise<ParsedWebhook>;
  refund?(args: { externalId: string; amountCents?: number }): Promise<{ refundId: string }>;
}
