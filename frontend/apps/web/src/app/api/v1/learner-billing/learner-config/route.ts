import { createTenantRoute } from "@atlas/api";
import {
  LearnerBillingConfigResponseSchema,
  UpdateLearnerConfigRequestSchema,
  type LearnerBillingConfigResponse,
  type UpdateLearnerConfigRequest,
} from "@atlas/domain-config/schemas/learner-billing";
import { updateLearnerConfig } from "@atlas/domain-config/services/learner-billing.service";
import { routeMetadata } from "./route.metadata";

export const PUT = createTenantRoute<UpdateLearnerConfigRequest, LearnerBillingConfigResponse>({
  metadata: routeMetadata,
  body: UpdateLearnerConfigRequestSchema,
  output: LearnerBillingConfigResponseSchema,
  handler: async ({ tx, input }) => updateLearnerConfig(tx, input),
});
