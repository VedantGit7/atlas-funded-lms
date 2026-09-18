import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  deleteMarketingEmailBodySchema,
  deleteMarketingEmailResponseSchema,
} from "../../../../../../../server/marketing-email/marketing-email.schemas";
import { mutateMarketingEmailMetadata } from "../../../../../../../server/marketing-email/marketing-email.route-metadata";
import { deleteMarketingEmailCampaign } from "../../../../../../../server/marketing-email/marketing-email.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof deleteMarketingEmailBodySchema>,
  z.output<typeof deleteMarketingEmailResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingEmailMetadata,
  params: paramsSchema,
  body: deleteMarketingEmailBodySchema,
  output: deleteMarketingEmailResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    deleteMarketingEmailCampaign(tx, ctx, params["id"], input),
});
