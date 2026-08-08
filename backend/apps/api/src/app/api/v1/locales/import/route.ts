import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  localeImportBodySchema,
  localeImportResponseSchema,
} from "../../../../../server/locales/locale.contract";
import { importLocaleResources } from "../../../../../server/locales/locale.service";
import { importLocaleResourcesMetadata } from "../../../../../server/locales/locale.route-metadata";

export const POST = createTenantRoute<
  z.output<typeof localeImportBodySchema>,
  z.output<typeof localeImportResponseSchema>
>({
  metadata: importLocaleResourcesMetadata,
  body: localeImportBodySchema,
  output: localeImportResponseSchema,
  handler: async ({ tx, ctx, input }) => importLocaleResources(tx, ctx, input),
});
