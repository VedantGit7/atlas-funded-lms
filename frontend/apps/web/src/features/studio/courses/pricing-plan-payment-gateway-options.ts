export const PRICING_PLAN_PAYMENT_GATEWAY_OPTIONS = [
  "Razorpay",
  "Stripe",
  "PayPal",
  "PayU",
  "Cashfree",
  "PhonePe",
] as const;

export type PricingPlanPaymentGatewayOption = (typeof PRICING_PLAN_PAYMENT_GATEWAY_OPTIONS)[number];

export function resolvePricingPlanPaymentGateway(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const match = PRICING_PLAN_PAYMENT_GATEWAY_OPTIONS.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? trimmed;
}
