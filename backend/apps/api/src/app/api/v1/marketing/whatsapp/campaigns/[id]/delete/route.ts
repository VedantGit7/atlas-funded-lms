import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  deleteWhatsappCampaignBodySchema,
  deleteWhatsappCampaignResponseSchema,
} from "../../../../../../../../server/whatsapp/whatsapp.schemas";
import { mutateWhatsappMetadata } from "../../../../../../../../server/whatsapp/whatsapp.route-metadata";
import { deleteWhatsappCampaign } from "../../../../../../../../server/whatsapp/whatsapp.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  z.output<typeof deleteWhatsappCampaignBodySchema>,
  z.output<typeof deleteWhatsappCampaignResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateWhatsappMetadata,
  params: paramsSchema,
  body: deleteWhatsappCampaignBodySchema,
  output: deleteWhatsappCampaignResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    deleteWhatsappCampaign(tx, ctx, params["id"], input),
});
