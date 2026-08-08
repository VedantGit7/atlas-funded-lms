import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  updateWalletConfigBodySchema,
  walletConfigResponseSchema,
} from "../../../../../../server/sales-wallet/sales-wallet.schemas";
import {
  adminWalletReadMetadata,
  adminWalletWriteMetadata,
} from "../../../../../../server/sales-wallet/sales-wallet.route-metadata";
import {
  getWalletConfig,
  updateWalletConfig,
} from "../../../../../../server/sales-wallet/sales-wallet.service";

export const GET = createTenantRoute<undefined, z.output<typeof walletConfigResponseSchema>>({
  metadata: adminWalletReadMetadata,
  output: walletConfigResponseSchema,
  handler: async ({ tx, ctx }) => getWalletConfig(tx, ctx),
});

export const PUT = createTenantRoute<
  z.output<typeof updateWalletConfigBodySchema>,
  z.output<typeof walletConfigResponseSchema>
>({
  metadata: adminWalletWriteMetadata,
  body: updateWalletConfigBodySchema,
  output: walletConfigResponseSchema,
  handler: async ({ tx, ctx, input }) => updateWalletConfig(tx, ctx, input),
});
