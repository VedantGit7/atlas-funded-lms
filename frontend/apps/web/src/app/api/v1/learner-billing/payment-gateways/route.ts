import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  AddPaymentGatewayRequestSchema,
  PaymentGatewayListResponseSchema,
  PaymentGatewayResponseSchema,
  type AddPaymentGatewayRequest,
  type PaymentGatewayListResponse,
  type PaymentGatewayResponse,
} from "@atlas/domain-config/schemas/payment-gateway";
import {
  addPaymentGateway,
  listPaymentGateways,
} from "@atlas/domain-config/services/payment-gateway.service";
import { getRouteMetadata, postRouteMetadata } from "./route.metadata";

export const GET = createTenantRoute<Record<string, never>, PaymentGatewayListResponse>({
  metadata: getRouteMetadata,
  input: noBodySchema,
  output: PaymentGatewayListResponseSchema,
  handler: async ({ tx }) => listPaymentGateways(tx),
});

export const POST = createTenantRoute<AddPaymentGatewayRequest, PaymentGatewayResponse>({
  metadata: postRouteMetadata,
  body: AddPaymentGatewayRequestSchema,
  output: PaymentGatewayResponseSchema,
  handler: async ({ tx, input }) => addPaymentGateway(tx, input.gatewayKey),
});
