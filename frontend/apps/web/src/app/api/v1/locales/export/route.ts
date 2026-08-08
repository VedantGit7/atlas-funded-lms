import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  localeExportQuerySchema,
  localeExportResponseSchema,
} from "../../../../../server/locales/locale.contract";
import { exportLocaleResources } from "../../../../../server/locales/locale.service";
import { exportLocaleResourcesMetadata } from "../../../../../server/locales/locale.route-metadata";

export const GET = createTenantRoute<
  z.output<typeof localeExportQuerySchema>,
  z.output<typeof localeExportResponseSchema>
>({
  metadata: exportLocaleResourcesMetadata,
  input: localeExportQuerySchema,
  output: localeExportResponseSchema,
  handler: async ({ tx, ctx, input }) => exportLocaleResources(tx, ctx, input.locale),
});
