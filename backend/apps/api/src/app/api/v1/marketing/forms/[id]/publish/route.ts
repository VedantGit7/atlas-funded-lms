import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { z as zod } from "zod";
import { marketingFormResponseSchema } from "../../../../../../../server/marketing-forms/marketing-forms.schemas";
import { mutateMarketingFormsMetadata } from "../../../../../../../server/marketing-forms/marketing-forms.route-metadata";
import { publishMarketingForm } from "../../../../../../../server/marketing-forms/marketing-forms.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof marketingFormResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingFormsMetadata,
  params: paramsSchema,
  body: noBodySchema,
  output: marketingFormResponseSchema,
  handler: async ({ tx, ctx, params }) => publishMarketingForm(tx, ctx, params.id),
});
