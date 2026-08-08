import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { myWalletResponseSchema } from "../../../../../server/sales-wallet/sales-wallet.schemas";
import { learnerWalletReadMetadata } from "../../../../../server/sales-wallet/sales-wallet.route-metadata";
import { getMyWallet } from "../../../../../server/sales-wallet/sales-wallet.service";

export const GET = createTenantRoute<undefined, z.output<typeof myWalletResponseSchema>>({
  metadata: learnerWalletReadMetadata,
  output: myWalletResponseSchema,
  handler: async ({ tx, ctx }) => getMyWallet(tx, ctx),
});
