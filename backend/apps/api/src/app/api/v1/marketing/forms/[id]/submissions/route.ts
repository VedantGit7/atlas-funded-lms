import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { marketingFormSubmissionsResponseSchema } from "../../../../../../../server/marketing-forms/marketing-forms.schemas";
import { listMarketingFormsMetadata } from "../../../../../../../server/marketing-forms/marketing-forms.route-metadata";
import { listMarketingFormSubmissions } from "../../../../../../../server/marketing-forms/marketing-forms.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof marketingFormSubmissionsResponseSchema>,
  typeof paramsSchema
>({
  metadata: listMarketingFormsMetadata,
  params: paramsSchema,
  output: marketingFormSubmissionsResponseSchema,
  handler: async ({ tx, ctx, params }) => listMarketingFormSubmissions(tx, ctx, params["id"]),
});
