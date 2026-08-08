import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportsHistoryListQuerySchema,
  exportsHistoryListResponseSchema,
} from "@atlas/domain/reports/exports-roster.dto";
import { listExportsRosterMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";
import { listExportsHistory } from "@atlas/domain/reports/exports-roster.service";

export const GET = createTenantRoute<
  z.output<typeof exportsHistoryListQuerySchema>,
  z.output<typeof exportsHistoryListResponseSchema>
>({
  metadata: listExportsRosterMetadata,
  input: exportsHistoryListQuerySchema,
  output: exportsHistoryListResponseSchema,
  handler: async ({ tx, ctx, input }) => listExportsHistory(tx, ctx, input),
});
