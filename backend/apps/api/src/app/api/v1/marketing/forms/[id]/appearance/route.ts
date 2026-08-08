import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  marketingFormResponseSchema,
  updateMarketingFormAppearanceBodySchema,
} from "../../../../../../../server/marketing-forms/marketing-forms.schemas";
import { mutateMarketingFormsMetadata } from "../../../../../../../server/marketing-forms/marketing-forms.route-metadata";
import { updateMarketingFormAppearance } from "../../../../../../../server/marketing-forms/marketing-forms.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const PATCH = createTenantRoute<
  z.output<typeof updateMarketingFormAppearanceBodySchema>,
  z.output<typeof marketingFormResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingFormsMetadata,
  params: paramsSchema,
  body: updateMarketingFormAppearanceBodySchema,
  output: marketingFormResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateMarketingFormAppearance(tx, ctx, params.id, input),
});
