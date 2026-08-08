import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  batchIdParamsSchema,
  batchMessagesAudiencesResponseSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { listBatchMessageAudiences } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof batchMessagesAudiencesResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: noBodySchema,
  params: batchIdParamsSchema,
  output: batchMessagesAudiencesResponseSchema,
  handler: async ({ tx, ctx, params }) => listBatchMessageAudiences(tx, ctx, params["batchId"]),
});
