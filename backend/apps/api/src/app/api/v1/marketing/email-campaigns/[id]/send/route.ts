import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  sendMarketingEmailBodySchema,
  sendMarketingEmailResponseSchema,
} from "../../../../../../../server/marketing-email/marketing-email.schemas";
import { mutateMarketingEmailMetadata } from "../../../../../../../server/marketing-email/marketing-email.route-metadata";
import { sendMarketingEmail } from "../../../../../../../server/marketing-email/marketing-email.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  z.output<typeof sendMarketingEmailBodySchema>,
  z.output<typeof sendMarketingEmailResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingEmailMetadata,
  params: paramsSchema,
  body: sendMarketingEmailBodySchema,
  output: sendMarketingEmailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => sendMarketingEmail(tx, ctx, params["id"], input),
});
