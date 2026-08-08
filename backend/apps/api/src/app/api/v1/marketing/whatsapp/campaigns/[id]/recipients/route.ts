import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { whatsappRecipientsResponseSchema } from "../../../../../../../../server/whatsapp/whatsapp.schemas";
import { listWhatsappMetadata } from "../../../../../../../../server/whatsapp/whatsapp.route-metadata";
import { listWhatsappCampaignRecipients } from "../../../../../../../../server/whatsapp/whatsapp.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof whatsappRecipientsResponseSchema>,
  typeof paramsSchema
>({
  metadata: listWhatsappMetadata,
  params: paramsSchema,
  output: whatsappRecipientsResponseSchema,
  handler: async ({ tx, ctx, params }) => listWhatsappCampaignRecipients(tx, ctx, params.id),
});
