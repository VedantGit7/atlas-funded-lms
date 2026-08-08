import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  walletAccountsListQuerySchema,
  walletAccountsListResponseSchema,
} from "../../../../../../server/sales-wallet/sales-wallet.schemas";
import { adminWalletReadMetadata } from "../../../../../../server/sales-wallet/sales-wallet.route-metadata";
import { listWalletAccounts } from "../../../../../../server/sales-wallet/sales-wallet.service";

export const GET = createTenantRoute<
  z.output<typeof walletAccountsListQuerySchema>,
  z.output<typeof walletAccountsListResponseSchema>
>({
  metadata: adminWalletReadMetadata,
  input: walletAccountsListQuerySchema,
  output: walletAccountsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listWalletAccounts(tx, ctx, input),
});
