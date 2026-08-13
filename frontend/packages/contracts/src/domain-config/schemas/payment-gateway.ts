import { z } from "zod";
import { PAYMENT_GATEWAY_KEYS } from "./payment-gateway-catalog";

const gatewayKeySet = new Set<string>(PAYMENT_GATEWAY_KEYS);

/** A tenant's payment gateway, never exposing the secret key itself. */
export const PaymentGatewayViewSchema = z.object({
  id: z.string(),
  gatewayKey: z.string(),
  displayName: z.string(),
  userId: z.string().nullable(),
  publishableKey: z.string().nullable(),
  billingLocationId: z.string().nullable(),
  hasSecret: z.boolean(),
  secretLast4: z.string().nullable(),
  isDefault: z.boolean(),
  isConfigured: z.boolean(),
  isPublished: z.boolean(),
  updatedAt: z.iso.datetime(),
});

export const PaymentGatewayListResponseSchema = z.object({
  data: z.array(PaymentGatewayViewSchema),
});

export const PaymentGatewayResponseSchema = z.object({
  data: PaymentGatewayViewSchema,
});

export const AddPaymentGatewayRequestSchema = z.object({
  gatewayKey: z.string().refine((value) => gatewayKeySet.has(value), {
    message: "Unknown payment gateway.",
  }),
});

export const PaymentGatewayIdParamSchema = z.object({
  id: z.uuid(),
});

export const UpdatePaymentGatewayConfigRequestSchema = z.object({
  userId: z.string().trim().min(1).max(500),
  publishableKey: z.string().trim().min(1).max(2000),
  /** Only sent when setting or rotating the secret; omitted keeps the existing one. */
  secretKey: z.string().trim().min(1).max(4000).optional(),
  billingLocationId: z.uuid().nullable().optional(),
  isDefault: z.boolean(),
});

export const PublishPaymentGatewayRequestSchema = z.object({
  published: z.boolean(),
});

export type PaymentGatewayView = z.infer<typeof PaymentGatewayViewSchema>;
export type PaymentGatewayListResponse = z.infer<typeof PaymentGatewayListResponseSchema>;
export type PaymentGatewayResponse = z.infer<typeof PaymentGatewayResponseSchema>;
export type AddPaymentGatewayRequest = z.infer<typeof AddPaymentGatewayRequestSchema>;
export type UpdatePaymentGatewayConfigRequest = z.infer<
  typeof UpdatePaymentGatewayConfigRequestSchema
>;
export type PublishPaymentGatewayRequest = z.infer<typeof PublishPaymentGatewayRequestSchema>;
