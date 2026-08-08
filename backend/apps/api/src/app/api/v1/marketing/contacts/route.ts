import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  marketingContactsListQuerySchema,
  marketingContactsListResponseSchema,
} from "../../../../../server/marketing-forms/marketing-forms.schemas";
import { listMarketingFormsMetadata } from "../../../../../server/marketing-forms/marketing-forms.route-metadata";
import { listMarketingContacts } from "../../../../../server/marketing-forms/marketing-forms.service";

export const GET = createTenantRoute<
  z.output<typeof marketingContactsListQuerySchema>,
  z.output<typeof marketingContactsListResponseSchema>
>({
  metadata: listMarketingFormsMetadata,
  input: marketingContactsListQuerySchema,
  output: marketingContactsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listMarketingContacts(tx, ctx, input),
});
