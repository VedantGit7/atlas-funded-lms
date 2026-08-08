import { createTenantRoute } from "@atlas/api";
import {
  PaymentGatewayIdParamSchema,
  PaymentGatewayResponseSchema,
  PublishPaymentGatewayRequestSchema,
  type PaymentGatewayResponse,
  type PublishPaymentGatewayRequest,
} from "@atlas/domain-config/schemas/payment-gateway";
import { publishPaymentGateway } from "@atlas/domain-config/services/payment-gateway.service";
import { routeMetadata } from "./route.metadata";

export const PUT = createTenantRoute<PublishPaymentGatewayRequest, PaymentGatewayResponse>({
  metadata: routeMetadata,
  params: PaymentGatewayIdParamSchema,
  body: PublishPaymentGatewayRequestSchema,
  output: PaymentGatewayResponseSchema,
  handler: async ({ tx, params, input }) => {
    const { id } = PaymentGatewayIdParamSchema.parse(params);
    return publishPaymentGateway(tx, id, input.published);
  },
});
