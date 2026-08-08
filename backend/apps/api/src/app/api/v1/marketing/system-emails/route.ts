import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { systemEmailsListResponseSchema } from "../../../../../server/system-email/system-email.schemas";
import { listSystemEmailsMetadata } from "../../../../../server/system-email/system-email.route-metadata";
import { listSystemEmails } from "../../../../../server/system-email/system-email.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof systemEmailsListResponseSchema>
>({
  metadata: listSystemEmailsMetadata,
  output: systemEmailsListResponseSchema,
  handler: async ({ tx, ctx }) => listSystemEmails(tx, ctx),
});
