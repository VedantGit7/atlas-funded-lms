import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  replyWhatsappInboxBodySchema,
  whatsappConversationDetailResponseSchema,
} from "../../../../../../../server/whatsapp/whatsapp.schemas";
import {
  listWhatsappMetadata,
  mutateWhatsappMetadata,
} from "../../../../../../../server/whatsapp/whatsapp.route-metadata";
import {
  getWhatsappConversation,
  replyWhatsappConversation,
} from "../../../../../../../server/whatsapp/whatsapp.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof whatsappConversationDetailResponseSchema>,
  typeof paramsSchema
>({
  metadata: listWhatsappMetadata,
  params: paramsSchema,
  output: whatsappConversationDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getWhatsappConversation(tx, ctx, params["id"]),
});

export const POST = createTenantRoute<
  z.output<typeof replyWhatsappInboxBodySchema>,
  z.output<typeof whatsappConversationDetailResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateWhatsappMetadata,
  params: paramsSchema,
  body: replyWhatsappInboxBodySchema,
  output: whatsappConversationDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    replyWhatsappConversation(tx, ctx, params["id"], input),
});
