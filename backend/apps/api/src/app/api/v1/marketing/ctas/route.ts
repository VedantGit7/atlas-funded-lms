import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createMarketingCtaBodySchema,
  marketingCtaResponseSchema,
  marketingCtasListQuerySchema,
  marketingCtasListResponseSchema,
} from "../../../../../server/marketing-cta/marketing-cta.schemas";
import {
  listMarketingCtasMetadata,
  mutateMarketingCtasMetadata,
} from "../../../../../server/marketing-cta/marketing-cta.route-metadata";
import {
  createMarketingCta,
  listMarketingCtas,
} from "../../../../../server/marketing-cta/marketing-cta.service";

export const GET = createTenantRoute<
  z.output<typeof marketingCtasListQuerySchema>,
  z.output<typeof marketingCtasListResponseSchema>
>({
  metadata: listMarketingCtasMetadata,
  input: marketingCtasListQuerySchema,
  output: marketingCtasListResponseSchema,
  handler: async ({ tx, ctx, input }) => listMarketingCtas(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createMarketingCtaBodySchema>,
  z.output<typeof marketingCtaResponseSchema>
>({
  metadata: mutateMarketingCtasMetadata,
  body: createMarketingCtaBodySchema,
  output: marketingCtaResponseSchema,
  handler: async ({ tx, ctx, input }) => createMarketingCta(tx, ctx, input),
});
