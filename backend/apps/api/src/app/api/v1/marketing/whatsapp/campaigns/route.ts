import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  whatsappCampaignsListQuerySchema,
  whatsappCampaignsListResponseSchema,
  createWhatsappCampaignBodySchema,
  whatsappCampaignResponseSchema,
} from "@atlas/api-server/whatsapp/whatsapp.schemas";
import {
  listWhatsappMetadata,
  mutateWhatsappMetadata,
} from "@atlas/api-server/whatsapp/whatsapp.route-metadata";
import {
  createWhatsappCampaign,
  listWhatsappCampaigns,
} from "@atlas/api-server/whatsapp/whatsapp.service";

export const GET = createTenantRoute<
  z.output<typeof whatsappCampaignsListQuerySchema>,
  z.output<typeof whatsappCampaignsListResponseSchema>
>({
  metadata: listWhatsappMetadata,
  input: whatsappCampaignsListQuerySchema,
  output: whatsappCampaignsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listWhatsappCampaigns(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createWhatsappCampaignBodySchema>,
  z.output<typeof whatsappCampaignResponseSchema>
>({
  metadata: mutateWhatsappMetadata,
  body: createWhatsappCampaignBodySchema,
  output: whatsappCampaignResponseSchema,
  handler: async ({ tx, ctx, input }) => createWhatsappCampaign(tx, ctx, input),
});
