import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { marketingEmailTemplatesResponseSchema } from "../../../../../../server/marketing-email/marketing-email.schemas";
import { listMarketingEmailMetadata } from "../../../../../../server/marketing-email/marketing-email.route-metadata";
import { listMarketingEmailTemplates } from "../../../../../../server/marketing-email/marketing-email.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof marketingEmailTemplatesResponseSchema>
>({
  metadata: listMarketingEmailMetadata,
  output: marketingEmailTemplatesResponseSchema,
  handler: async () => listMarketingEmailTemplates(),
});
