import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  simulateWhatsappInboundBodySchema,
  whatsappConversationDetailResponseSchema,
  whatsappConversationsListResponseSchema,
} from "../../../../../../server/whatsapp/whatsapp.schemas";
import {
  listWhatsappMetadata,
  mutateWhatsappMetadata,
} from "../../../../../../server/whatsapp/whatsapp.route-metadata";
import {
  listWhatsappConversations,
  simulateWhatsappInbound,
} from "../../../../../../server/whatsapp/whatsapp.service";

export const GET = createTenantRoute<
  undefined,
  z.output<typeof whatsappConversationsListResponseSchema>
>({
  metadata: listWhatsappMetadata,
  output: whatsappConversationsListResponseSchema,
  handler: async ({ tx, ctx }) => listWhatsappConversations(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof simulateWhatsappInboundBodySchema>,
  z.output<typeof whatsappConversationDetailResponseSchema>
>({
  metadata: mutateWhatsappMetadata,
  body: simulateWhatsappInboundBodySchema,
  output: whatsappConversationDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => simulateWhatsappInbound(tx, ctx, input),
});
