import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createMarketingFormBodySchema,
  marketingFormResponseSchema,
  marketingFormsListQuerySchema,
  marketingFormsListResponseSchema,
} from "../../../../../server/marketing-forms/marketing-forms.schemas";
import {
  listMarketingFormsMetadata,
  mutateMarketingFormsMetadata,
} from "../../../../../server/marketing-forms/marketing-forms.route-metadata";
import {
  createMarketingForm,
  listMarketingForms,
} from "../../../../../server/marketing-forms/marketing-forms.service";

export const GET = createTenantRoute<
  z.output<typeof marketingFormsListQuerySchema>,
  z.output<typeof marketingFormsListResponseSchema>
>({
  metadata: listMarketingFormsMetadata,
  input: marketingFormsListQuerySchema,
  output: marketingFormsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listMarketingForms(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createMarketingFormBodySchema>,
  z.output<typeof marketingFormResponseSchema>
>({
  metadata: mutateMarketingFormsMetadata,
  body: createMarketingFormBodySchema,
  output: marketingFormResponseSchema,
  handler: async ({ tx, ctx, input }) => createMarketingForm(tx, ctx, input),
});
