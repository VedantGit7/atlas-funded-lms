import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  referralWalletListResponseSchema,
  referralWalletQuerySchema,
} from "@atlas/domain/reports/sales-marketing-roster.dto";
import { listSalesMarketingRosterMetadata } from "@atlas/domain/reports/sales-marketing-roster.route-metadata";
import { listReferralWalletRoster } from "@atlas/domain/reports/sales-marketing-roster.service";

export const GET = createTenantRoute<
  z.output<typeof referralWalletQuerySchema>,
  z.output<typeof referralWalletListResponseSchema>
>({
  metadata: listSalesMarketingRosterMetadata,
  input: referralWalletQuerySchema,
  output: referralWalletListResponseSchema,
  handler: async ({ tx, ctx, input }) => listReferralWalletRoster(tx, ctx, input),
});
