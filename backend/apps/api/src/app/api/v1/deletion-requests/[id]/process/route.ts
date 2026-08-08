import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  deletionRequestParamsSchema,
  processDeletionRequestBodySchema,
  processDeletionRequestResponseSchema,
} from "@atlas/domain/data-rights/data-rights.dto";
import { processDeletionRequest } from "@atlas/domain/data-rights/data-rights.service";
import { processDeletionRequestMetadata } from "@atlas/domain/data-rights/data-rights.route-metadata";

export const POST = createTenantRoute<
  z.output<typeof processDeletionRequestBodySchema>,
  z.output<typeof processDeletionRequestResponseSchema>,
  typeof deletionRequestParamsSchema
>({
  metadata: processDeletionRequestMetadata,
  params: deletionRequestParamsSchema,
  body: processDeletionRequestBodySchema,
  output: processDeletionRequestResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    processDeletionRequest(tx, ctx, params["id"] ?? "", input),
});
