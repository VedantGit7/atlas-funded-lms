import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  marketingCtaResponseSchema,
  updateMarketingCtaBasicsBodySchema,
} from "../../../../../../server/marketing-cta/marketing-cta.schemas";
import {
  listMarketingCtasMetadata,
  mutateMarketingCtasMetadata,
} from "../../../../../../server/marketing-cta/marketing-cta.route-metadata";
import {
  getMarketingCta,
  updateMarketingCtaBasics,
} from "../../../../../../server/marketing-cta/marketing-cta.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof marketingCtaResponseSchema>,
  typeof paramsSchema
>({
  metadata: listMarketingCtasMetadata,
  params: paramsSchema,
  output: marketingCtaResponseSchema,
  handler: async ({ tx, ctx, params }) => getMarketingCta(tx, ctx, params["id"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateMarketingCtaBasicsBodySchema>,
  z.output<typeof marketingCtaResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingCtasMetadata,
  params: paramsSchema,
  body: updateMarketingCtaBasicsBodySchema,
  output: marketingCtaResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateMarketingCtaBasics(tx, ctx, params["id"], input),
});
