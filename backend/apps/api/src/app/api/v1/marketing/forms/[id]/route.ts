import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  marketingFormResponseSchema,
  updateMarketingFormBasicsBodySchema,
} from "../../../../../../server/marketing-forms/marketing-forms.schemas";
import {
  listMarketingFormsMetadata,
  mutateMarketingFormsMetadata,
} from "../../../../../../server/marketing-forms/marketing-forms.route-metadata";
import {
  getMarketingForm,
  updateMarketingFormBasics,
} from "../../../../../../server/marketing-forms/marketing-forms.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof marketingFormResponseSchema>,
  typeof paramsSchema
>({
  metadata: listMarketingFormsMetadata,
  params: paramsSchema,
  output: marketingFormResponseSchema,
  handler: async ({ tx, ctx, params }) => getMarketingForm(tx, ctx, params["id"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateMarketingFormBasicsBodySchema>,
  z.output<typeof marketingFormResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingFormsMetadata,
  params: paramsSchema,
  body: updateMarketingFormBasicsBodySchema,
  output: marketingFormResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateMarketingFormBasics(tx, ctx, params["id"], input),
});
