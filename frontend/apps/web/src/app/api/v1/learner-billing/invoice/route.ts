import { createTenantRoute } from "@atlas/api";
import {
  LearnerBillingConfigResponseSchema,
  UpdateInvoiceRequestSchema,
  type LearnerBillingConfigResponse,
  type UpdateInvoiceRequest,
} from "@atlas/domain-config/schemas/learner-billing";
import { updateLearnerBillingInvoice } from "@atlas/domain-config/services/learner-billing.service";
import { routeMetadata } from "./route.metadata";

export const PUT = createTenantRoute<UpdateInvoiceRequest, LearnerBillingConfigResponse>({
  metadata: routeMetadata,
  body: UpdateInvoiceRequestSchema,
  output: LearnerBillingConfigResponseSchema,
  handler: async ({ tx, input }) => updateLearnerBillingInvoice(tx, input),
});
