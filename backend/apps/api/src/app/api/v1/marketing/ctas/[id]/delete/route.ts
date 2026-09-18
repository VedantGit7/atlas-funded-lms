import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  deleteMarketingCtaBodySchema,
  deleteMarketingCtaResponseSchema,
} from "../../../../../../../server/marketing-cta/marketing-cta.schemas";
import { mutateMarketingCtasMetadata } from "../../../../../../../server/marketing-cta/marketing-cta.route-metadata";
import { deleteMarketingCta } from "../../../../../../../server/marketing-cta/marketing-cta.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof deleteMarketingCtaBodySchema>,
  z.output<typeof deleteMarketingCtaResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingCtasMetadata,
  params: paramsSchema,
  body: deleteMarketingCtaBodySchema,
  output: deleteMarketingCtaResponseSchema,
  handler: async ({ tx, ctx, params, input }) => deleteMarketingCta(tx, ctx, params["id"], input),
});
