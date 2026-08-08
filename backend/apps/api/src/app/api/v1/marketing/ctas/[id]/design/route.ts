import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  marketingCtaResponseSchema,
  updateMarketingCtaDesignBodySchema,
} from "../../../../../../../server/marketing-cta/marketing-cta.schemas";
import { mutateMarketingCtasMetadata } from "../../../../../../../server/marketing-cta/marketing-cta.route-metadata";
import { updateMarketingCtaDesign } from "../../../../../../../server/marketing-cta/marketing-cta.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const PATCH = createTenantRoute<
  z.output<typeof updateMarketingCtaDesignBodySchema>,
  z.output<typeof marketingCtaResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingCtasMetadata,
  params: paramsSchema,
  body: updateMarketingCtaDesignBodySchema,
  output: marketingCtaResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateMarketingCtaDesign(tx, ctx, params["id"], input),
});
