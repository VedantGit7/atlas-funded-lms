import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  walletAccountDetailQuerySchema,
  walletAccountDetailResponseSchema,
} from "../../../../../../../server/sales-wallet/sales-wallet.schemas";
import { adminWalletReadMetadata } from "../../../../../../../server/sales-wallet/sales-wallet.route-metadata";
import { getWalletAccountDetail } from "../../../../../../../server/sales-wallet/sales-wallet.service";

const paramsSchema = zod.object({ membershipId: zod.string().uuid() });

export const GET = createTenantRoute<
  z.output<typeof walletAccountDetailQuerySchema>,
  z.output<typeof walletAccountDetailResponseSchema>,
  typeof paramsSchema
>({
  metadata: adminWalletReadMetadata,
  params: paramsSchema,
  input: walletAccountDetailQuerySchema,
  output: walletAccountDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    getWalletAccountDetail(tx, ctx, params["membershipId"]!, input),
});
