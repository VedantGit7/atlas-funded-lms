import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  LearnerBillingConfigResponseSchema,
  UpdatePricingModelRequestSchema,
  type LearnerBillingConfigResponse,
  type UpdatePricingModelRequest,
} from "@atlas/domain-config/schemas/learner-billing";
import {
  readLearnerBillingConfig,
  updateLearnerBillingPricingModel,
} from "@atlas/domain-config/services/learner-billing.service";
import { getRouteMetadata, putRouteMetadata } from "./route.metadata";

export const GET = createTenantRoute<Record<string, never>, LearnerBillingConfigResponse>({
  metadata: getRouteMetadata,
  input: noBodySchema,
  output: LearnerBillingConfigResponseSchema,
  handler: async ({ tx }) => readLearnerBillingConfig(tx),
});

export const PUT = createTenantRoute<UpdatePricingModelRequest, LearnerBillingConfigResponse>({
  metadata: putRouteMetadata,
  body: UpdatePricingModelRequestSchema,
  output: LearnerBillingConfigResponseSchema,
  handler: async ({ tx, input }) => updateLearnerBillingPricingModel(tx, input.pricingModel),
});
