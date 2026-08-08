import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  localeImportPreviewBodySchema,
  localeImportPreviewResponseSchema,
} from "../../../../../../server/locales/locale.contract";
import { previewLocaleImport } from "../../../../../../server/locales/locale.service";
import { previewLocaleImportMetadata } from "../../../../../../server/locales/locale.route-metadata";

export const POST = createTenantRoute<
  z.output<typeof localeImportPreviewBodySchema>,
  z.output<typeof localeImportPreviewResponseSchema>
>({
  metadata: previewLocaleImportMetadata,
  body: localeImportPreviewBodySchema,
  output: localeImportPreviewResponseSchema,
  handler: async ({ tx, ctx, input }) => previewLocaleImport(tx, ctx, input),
});
