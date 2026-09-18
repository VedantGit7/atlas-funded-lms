import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  deleteMarketingFormBodySchema,
  deleteMarketingFormResponseSchema,
} from "../../../../../../../server/marketing-forms/marketing-forms.schemas";
import { mutateMarketingFormsMetadata } from "../../../../../../../server/marketing-forms/marketing-forms.route-metadata";
import { deleteMarketingForm } from "../../../../../../../server/marketing-forms/marketing-forms.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof deleteMarketingFormBodySchema>,
  z.output<typeof deleteMarketingFormResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingFormsMetadata,
  params: paramsSchema,
  body: deleteMarketingFormBodySchema,
  output: deleteMarketingFormResponseSchema,
  handler: async ({ tx, ctx, params, input }) => deleteMarketingForm(tx, ctx, params["id"], input),
});
