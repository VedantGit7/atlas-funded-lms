import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  sendSalesMessageBodySchema,
  sendSalesMessageResponseSchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";
import { mutateSalesMarketingRosterMetadata } from "@atlas/domain/reports/sales-marketing-roster.route-metadata";
import { sendSalesMarketingMessage } from "../../../../../../../server/reports/sales-marketing-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof sendSalesMessageBodySchema>,
  z.output<typeof sendSalesMessageResponseSchema>
>({
  metadata: mutateSalesMarketingRosterMetadata,
  body: sendSalesMessageBodySchema,
  output: sendSalesMessageResponseSchema,
  handler: async ({ tx, ctx, input }) => sendSalesMarketingMessage(tx, ctx, input),
});
