import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  PaymentGatewayIdParamSchema,
  PaymentGatewayResponseSchema,
  UpdatePaymentGatewayConfigRequestSchema,
  type PaymentGatewayResponse,
  type UpdatePaymentGatewayConfigRequest,
} from "@atlas/domain-config/schemas/payment-gateway";
import {
  configurePaymentGateway,
  getPaymentGateway,
} from "@atlas/domain-config/services/payment-gateway.service";
import { getRouteMetadata, putRouteMetadata } from "./route.metadata";

export const GET = createTenantRoute<Record<string, never>, PaymentGatewayResponse>({
  metadata: getRouteMetadata,
  params: PaymentGatewayIdParamSchema,
  input: noBodySchema,
  output: PaymentGatewayResponseSchema,
  handler: async ({ tx, params }) => {
    const { id } = PaymentGatewayIdParamSchema.parse(params);
    return getPaymentGateway(tx, id);
  },
});

export const PUT = createTenantRoute<UpdatePaymentGatewayConfigRequest, PaymentGatewayResponse>({
  metadata: putRouteMetadata,
  params: PaymentGatewayIdParamSchema,
  body: UpdatePaymentGatewayConfigRequestSchema,
  output: PaymentGatewayResponseSchema,
  handler: async ({ tx, params, input }) => {
    const { id } = PaymentGatewayIdParamSchema.parse(params);
    return configurePaymentGateway(tx, id, input);
  },
});
