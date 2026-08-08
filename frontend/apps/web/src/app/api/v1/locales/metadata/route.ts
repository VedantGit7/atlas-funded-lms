import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { localeMetadataListResponseSchema } from "../../../../../server/locales/locale.contract";
import { listLocaleMetadata } from "../../../../../server/locales/locale.service";
import { listLocaleMetadataMetadata } from "../../../../../server/locales/locale.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof localeMetadataListResponseSchema>
>({
  metadata: listLocaleMetadataMetadata,
  output: localeMetadataListResponseSchema,
  handler: async ({ tx, ctx }) => listLocaleMetadata(tx, ctx),
});
