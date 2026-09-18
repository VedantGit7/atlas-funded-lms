import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  updateWhatsappCampaignTitleBodySchema,
  whatsappCampaignResponseSchema,
} from "../../../../../../../server/whatsapp/whatsapp.schemas";
import {
  listWhatsappMetadata,
  mutateWhatsappMetadata,
} from "../../../../../../../server/whatsapp/whatsapp.route-metadata";
import {
  getWhatsappCampaign,
  updateWhatsappCampaignTitle,
} from "../../../../../../../server/whatsapp/whatsapp.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof whatsappCampaignResponseSchema>,
  typeof paramsSchema
>({
  metadata: listWhatsappMetadata,
  params: paramsSchema,
  output: whatsappCampaignResponseSchema,
  handler: async ({ tx, ctx, params }) => getWhatsappCampaign(tx, ctx, params["id"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateWhatsappCampaignTitleBodySchema>,
  z.output<typeof whatsappCampaignResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateWhatsappMetadata,
  params: paramsSchema,
  body: updateWhatsappCampaignTitleBodySchema,
  output: whatsappCampaignResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateWhatsappCampaignTitle(tx, ctx, params["id"], input),
});
