import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createSalesGroupBodySchema,
  createSalesGroupResponseSchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";
import { mutateSalesMarketingRosterMetadata } from "@atlas/domain/reports/sales-marketing-roster.route-metadata";
import { createSalesMarketingGroup } from "../../../../../../../server/reports/sales-marketing-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof createSalesGroupBodySchema>,
  z.output<typeof createSalesGroupResponseSchema>
>({
  metadata: mutateSalesMarketingRosterMetadata,
  body: createSalesGroupBodySchema,
  output: createSalesGroupResponseSchema,
  handler: async ({ tx, ctx, input }) => createSalesMarketingGroup(tx, ctx, input),
});
