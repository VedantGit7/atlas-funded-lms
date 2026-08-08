import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  connectWhatsappMetaBodySchema,
  whatsappConnectionResponseSchema,
} from "../../../../../../../server/whatsapp/whatsapp.schemas";
import { mutateWhatsappMetadata } from "../../../../../../../server/whatsapp/whatsapp.route-metadata";
import { connectWhatsappMeta } from "../../../../../../../server/whatsapp/whatsapp.service";

export const POST = createTenantRoute<
  z.output<typeof connectWhatsappMetaBodySchema>,
  z.output<typeof whatsappConnectionResponseSchema>
>({
  metadata: mutateWhatsappMetadata,
  body: connectWhatsappMetaBodySchema,
  output: whatsappConnectionResponseSchema,
  handler: async ({ tx, ctx, input }) => connectWhatsappMeta(tx, ctx, input),
});
