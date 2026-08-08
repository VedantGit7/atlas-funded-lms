import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createWhatsappTemplateBodySchema,
  whatsappTemplateResponseSchema,
  whatsappTemplatesListResponseSchema,
} from "../../../../../../server/whatsapp/whatsapp.schemas";
import {
  listWhatsappMetadata,
  mutateWhatsappMetadata,
} from "../../../../../../server/whatsapp/whatsapp.route-metadata";
import {
  createWhatsappTemplate,
  listWhatsappTemplates,
} from "../../../../../../server/whatsapp/whatsapp.service";

export const GET = createTenantRoute<
  undefined,
  z.output<typeof whatsappTemplatesListResponseSchema>
>({
  metadata: listWhatsappMetadata,
  output: whatsappTemplatesListResponseSchema,
  handler: async ({ tx, ctx }) => listWhatsappTemplates(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createWhatsappTemplateBodySchema>,
  z.output<typeof whatsappTemplateResponseSchema>
>({
  metadata: mutateWhatsappMetadata,
  body: createWhatsappTemplateBodySchema,
  output: whatsappTemplateResponseSchema,
  handler: async ({ tx, ctx, input }) => createWhatsappTemplate(tx, ctx, input),
});
