import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  spamCheckBodySchema,
  spamCheckResponseSchema,
} from "../../../../../../server/marketing-email/marketing-email.schemas";
import { mutateMarketingEmailMetadata } from "../../../../../../server/marketing-email/marketing-email.route-metadata";
import { checkMarketingEmailSpam } from "../../../../../../server/marketing-email/marketing-email.service";

export const POST = createTenantRoute<
  z.output<typeof spamCheckBodySchema>,
  z.output<typeof spamCheckResponseSchema>
>({
  metadata: mutateMarketingEmailMetadata,
  body: spamCheckBodySchema,
  output: spamCheckResponseSchema,
  handler: async ({ tx, input }) => checkMarketingEmailSpam(tx, input),
});
