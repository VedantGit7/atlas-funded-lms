import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  marketingCtaResponseSchema,
  updateMarketingCtaTargetingBodySchema,
} from "../../../../../../../server/marketing-cta/marketing-cta.schemas";
import { mutateMarketingCtasMetadata } from "../../../../../../../server/marketing-cta/marketing-cta.route-metadata";
import { updateMarketingCtaTargeting } from "../../../../../../../server/marketing-cta/marketing-cta.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const PATCH = createTenantRoute<
  z.output<typeof updateMarketingCtaTargetingBodySchema>,
  z.output<typeof marketingCtaResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingCtasMetadata,
  params: paramsSchema,
  body: updateMarketingCtaTargetingBodySchema,
  output: marketingCtaResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateMarketingCtaTargeting(tx, ctx, params["id"], input),
});
