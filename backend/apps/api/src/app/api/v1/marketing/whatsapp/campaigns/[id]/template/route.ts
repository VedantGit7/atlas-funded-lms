import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  selectWhatsappTemplateBodySchema,
  whatsappCampaignResponseSchema,
} from "../../../../../../../../server/whatsapp/whatsapp.schemas";
import { mutateWhatsappMetadata } from "../../../../../../../../server/whatsapp/whatsapp.route-metadata";
import { selectWhatsappCampaignTemplate } from "../../../../../../../../server/whatsapp/whatsapp.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof selectWhatsappTemplateBodySchema>,
  z.output<typeof whatsappCampaignResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateWhatsappMetadata,
  params: paramsSchema,
  body: selectWhatsappTemplateBodySchema,
  output: whatsappCampaignResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    selectWhatsappCampaignTemplate(tx, ctx, params["id"], input),
});
