import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  sendWhatsappCampaignBodySchema,
  whatsappCampaignResponseSchema,
} from "../../../../../../../../server/whatsapp/whatsapp.schemas";
import { mutateWhatsappMetadata } from "../../../../../../../../server/whatsapp/whatsapp.route-metadata";
import { sendWhatsappCampaign } from "../../../../../../../../server/whatsapp/whatsapp.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof sendWhatsappCampaignBodySchema>,
  z.output<typeof whatsappCampaignResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateWhatsappMetadata,
  params: paramsSchema,
  body: sendWhatsappCampaignBodySchema,
  output: whatsappCampaignResponseSchema,
  handler: async ({ tx, ctx, params, input }) => sendWhatsappCampaign(tx, ctx, params["id"], input),
});
