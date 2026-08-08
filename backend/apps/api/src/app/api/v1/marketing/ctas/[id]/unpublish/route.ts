import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { z as zod } from "zod";
import { marketingCtaResponseSchema } from "../../../../../../../server/marketing-cta/marketing-cta.schemas";
import { mutateMarketingCtasMetadata } from "../../../../../../../server/marketing-cta/marketing-cta.route-metadata";
import { unpublishMarketingCta } from "../../../../../../../server/marketing-cta/marketing-cta.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof marketingCtaResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingCtasMetadata,
  params: paramsSchema,
  body: noBodySchema,
  output: marketingCtaResponseSchema,
  handler: async ({ tx, ctx, params }) => unpublishMarketingCta(tx, ctx, params["id"]),
});
