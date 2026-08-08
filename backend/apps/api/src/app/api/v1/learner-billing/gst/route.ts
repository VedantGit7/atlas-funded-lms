import { createTenantRoute } from "@atlas/api";
import {
  LearnerBillingConfigResponseSchema,
  UpdateGstRequestSchema,
  type LearnerBillingConfigResponse,
  type UpdateGstRequest,
} from "@atlas/domain-config/schemas/learner-billing";
import { updateLearnerBillingGst } from "@atlas/domain-config/services/learner-billing.service";
import { routeMetadata } from "./route.metadata";

export const PUT = createTenantRoute<UpdateGstRequest, LearnerBillingConfigResponse>({
  metadata: routeMetadata,
  body: UpdateGstRequestSchema,
  output: LearnerBillingConfigResponseSchema,
  handler: async ({ tx, input }) => updateLearnerBillingGst(tx, input),
});
