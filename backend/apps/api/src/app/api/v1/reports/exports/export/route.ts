import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportExportsHistoryBodySchema,
  exportExportsHistoryResponseSchema,
} from "@atlas/domain/reports/exports-roster.dto";
import { exportExportsRosterMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";
import { exportExportsHistory } from "../../../../../../../server/reports/exports-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof exportExportsHistoryBodySchema>,
  z.output<typeof exportExportsHistoryResponseSchema>
>({
  metadata: exportExportsRosterMetadata,
  body: exportExportsHistoryBodySchema,
  output: exportExportsHistoryResponseSchema,
  handler: async ({ tx, ctx, input }) => exportExportsHistory(tx, ctx, input),
});
