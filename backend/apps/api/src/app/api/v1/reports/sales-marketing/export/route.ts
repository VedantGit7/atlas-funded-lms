import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportSalesMarketingBodySchema,
  exportSalesMarketingResponseSchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";
import { exportSalesMarketingRosterMetadata } from "@atlas/domain/reports/sales-marketing-roster.route-metadata";
import { exportSalesMarketingRoster } from "@atlas/api-server/reports/sales-marketing-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof exportSalesMarketingBodySchema>,
  z.output<typeof exportSalesMarketingResponseSchema>
>({
  metadata: exportSalesMarketingRosterMetadata,
  body: exportSalesMarketingBodySchema,
  output: exportSalesMarketingResponseSchema,
  handler: async ({ tx, ctx, input }) => exportSalesMarketingRoster(tx, ctx, input),
});
