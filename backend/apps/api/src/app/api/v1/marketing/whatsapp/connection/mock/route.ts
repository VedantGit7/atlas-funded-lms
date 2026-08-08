import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  connectWhatsappMockBodySchema,
  whatsappConnectionResponseSchema,
} from "../../../../../../../server/whatsapp/whatsapp.schemas";
import { mutateWhatsappMetadata } from "../../../../../../../server/whatsapp/whatsapp.route-metadata";
import { connectWhatsappMock } from "../../../../../../../server/whatsapp/whatsapp.service";

export const POST = createTenantRoute<
  z.output<typeof connectWhatsappMockBodySchema>,
  z.output<typeof whatsappConnectionResponseSchema>
>({
  metadata: mutateWhatsappMetadata,
  body: connectWhatsappMockBodySchema,
  output: whatsappConnectionResponseSchema,
  handler: async ({ tx, ctx, input }) => connectWhatsappMock(tx, ctx, input),
});
