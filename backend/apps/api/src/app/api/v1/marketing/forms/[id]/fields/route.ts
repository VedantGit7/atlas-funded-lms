import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  marketingFormResponseSchema,
  updateMarketingFormFieldsBodySchema,
} from "../../../../../../../server/marketing-forms/marketing-forms.schemas";
import { mutateMarketingFormsMetadata } from "../../../../../../../server/marketing-forms/marketing-forms.route-metadata";
import { updateMarketingFormFields } from "../../../../../../../server/marketing-forms/marketing-forms.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const PATCH = createTenantRoute<
  z.output<typeof updateMarketingFormFieldsBodySchema>,
  z.output<typeof marketingFormResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingFormsMetadata,
  params: paramsSchema,
  body: updateMarketingFormFieldsBodySchema,
  output: marketingFormResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateMarketingFormFields(tx, ctx, params["id"], input),
});
