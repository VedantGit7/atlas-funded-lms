import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportBatchRosterBodySchema,
  exportBatchRosterResponseSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { exportBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { exportBatchRoster } from "../../../../../../../server/reports/batches-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof exportBatchRosterBodySchema>,
  z.output<typeof exportBatchRosterResponseSchema>
>({
  metadata: exportBatchesRosterMetadata,
  body: exportBatchRosterBodySchema,
  output: exportBatchRosterResponseSchema,
  handler: async ({ tx, ctx, input }) => exportBatchRoster(tx, ctx, input),
});
