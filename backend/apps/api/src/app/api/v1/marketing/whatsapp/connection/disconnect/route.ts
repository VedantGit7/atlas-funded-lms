import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { whatsappConnectionResponseSchema } from "../../../../../../../server/whatsapp/whatsapp.schemas";
import { mutateWhatsappMetadata } from "../../../../../../../server/whatsapp/whatsapp.route-metadata";
import { disconnectWhatsapp } from "../../../../../../../server/whatsapp/whatsapp.service";

export const POST = createTenantRoute<
  undefined,
  z.output<typeof whatsappConnectionResponseSchema>
>({
  metadata: mutateWhatsappMetadata,
  output: whatsappConnectionResponseSchema,
  handler: async ({ tx, ctx }) => disconnectWhatsapp(tx, ctx),
});
