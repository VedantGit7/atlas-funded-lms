import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { whatsappConnectionResponseSchema } from "../../../../../../server/whatsapp/whatsapp.schemas";
import { listWhatsappMetadata } from "../../../../../../server/whatsapp/whatsapp.route-metadata";
import { getWhatsappConnection } from "../../../../../../server/whatsapp/whatsapp.service";

export const GET = createTenantRoute<
  undefined,
  z.output<typeof whatsappConnectionResponseSchema>
>({
  metadata: listWhatsappMetadata,
  output: whatsappConnectionResponseSchema,
  handler: async ({ tx, ctx }) => getWhatsappConnection(tx, ctx),
});
