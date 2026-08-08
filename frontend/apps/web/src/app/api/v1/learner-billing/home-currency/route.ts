import { createTenantRoute } from "@atlas/api";
import {
  LearnerBillingConfigResponseSchema,
  UpdateHomeCurrencyRequestSchema,
  type LearnerBillingConfigResponse,
  type UpdateHomeCurrencyRequest,
} from "@atlas/domain-config/schemas/learner-billing";
import { updateLearnerBillingHomeCurrency } from "@atlas/domain-config/services/learner-billing.service";
import { routeMetadata } from "./route.metadata";

export const PUT = createTenantRoute<UpdateHomeCurrencyRequest, LearnerBillingConfigResponse>({
  metadata: routeMetadata,
  body: UpdateHomeCurrencyRequestSchema,
  output: LearnerBillingConfigResponseSchema,
  handler: async ({ tx, input }) => updateLearnerBillingHomeCurrency(tx, input.currency),
});
