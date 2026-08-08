import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  sendBatchMessageBodySchema,
  sendBatchMessageResponseSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { mutateBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { sendBatchRosterMessage } from "@atlas/api-server/reports/batches-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof sendBatchMessageBodySchema>,
  z.output<typeof sendBatchMessageResponseSchema>
>({
  metadata: mutateBatchesRosterMetadata,
  body: sendBatchMessageBodySchema,
  output: sendBatchMessageResponseSchema,
  handler: async ({ tx, ctx, input }) => sendBatchRosterMessage(tx, ctx, input),
});
