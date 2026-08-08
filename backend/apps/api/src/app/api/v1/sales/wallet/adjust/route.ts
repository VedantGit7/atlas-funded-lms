import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  adjustWalletBodySchema,
  adjustWalletResponseSchema,
} from "../../../../../../server/sales-wallet/sales-wallet.schemas";
import { adminWalletWriteMetadata } from "../../../../../../server/sales-wallet/sales-wallet.route-metadata";
import { adjustWalletByAdmin } from "../../../../../../server/sales-wallet/sales-wallet.service";

export const POST = createTenantRoute<
  z.output<typeof adjustWalletBodySchema>,
  z.output<typeof adjustWalletResponseSchema>
>({
  metadata: adminWalletWriteMetadata,
  body: adjustWalletBodySchema,
  output: adjustWalletResponseSchema,
  handler: async ({ tx, ctx, input }) => adjustWalletByAdmin(tx, ctx, input),
});
