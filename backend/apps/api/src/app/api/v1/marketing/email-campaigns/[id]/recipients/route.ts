import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { marketingEmailRecipientsResponseSchema } from "../../../../../../../server/marketing-email/marketing-email.schemas";
import { listMarketingEmailMetadata } from "../../../../../../../server/marketing-email/marketing-email.route-metadata";
import { listMarketingEmailRecipients } from "../../../../../../../server/marketing-email/marketing-email.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof marketingEmailRecipientsResponseSchema>,
  typeof paramsSchema
>({
  metadata: listMarketingEmailMetadata,
  params: paramsSchema,
  output: marketingEmailRecipientsResponseSchema,
  handler: async ({ tx, ctx, params }) => listMarketingEmailRecipients(tx, ctx, params.id),
});
