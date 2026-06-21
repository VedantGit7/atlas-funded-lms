import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createDeletionRequestBodySchema,
  createDeletionRequestResponseSchema,
  deletionListQuerySchema,
  deletionListResponseSchema,
} from "@atlas/domain/data-rights/data-rights.dto";
import {
  createDeletionRequest,
  listDeletionRequests,
} from "@atlas/domain/data-rights/data-rights.service";
import {
  createDeletionRequestMetadata,
  listDeletionRequestsMetadata,
} from "@atlas/domain/data-rights/data-rights.route-metadata";

export const GET = createTenantRoute<
  z.output<typeof deletionListQuerySchema>,
  z.output<typeof deletionListResponseSchema>
>({
  metadata: listDeletionRequestsMetadata,
  input: deletionListQuerySchema,
  output: deletionListResponseSchema,
  handler: async ({ tx, ctx, input }) => listDeletionRequests(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createDeletionRequestBodySchema>,
  z.output<typeof createDeletionRequestResponseSchema>
>({
  metadata: createDeletionRequestMetadata,
  body: createDeletionRequestBodySchema,
  output: createDeletionRequestResponseSchema,
  handler: async ({ tx, ctx, input }) => createDeletionRequest(tx, ctx, input),
});
