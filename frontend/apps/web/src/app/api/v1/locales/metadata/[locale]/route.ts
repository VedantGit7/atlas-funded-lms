import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  localeCodeSchema,
  localeMetadataDeleteResponseSchema,
  localeMetadataUpsertResponseSchema,
  upsertLocaleMetadataBodySchema,
} from "../../../../../../server/locales/locale.contract";
import {
  deleteLocaleMetadata,
  upsertLocaleMetadata,
} from "../../../../../../server/locales/locale.service";
import {
  deleteLocaleMetadataMetadata,
  upsertLocaleMetadataMetadata,
} from "../../../../../../server/locales/locale.route-metadata";

export const PUT = createTenantRoute<
  z.output<typeof upsertLocaleMetadataBodySchema>,
  z.output<typeof localeMetadataUpsertResponseSchema>
>({
  metadata: upsertLocaleMetadataMetadata,
  body: upsertLocaleMetadataBodySchema,
  output: localeMetadataUpsertResponseSchema,
  handler: async ({ tx, ctx, input, params }) => {
    const locale = localeCodeSchema.parse(params["locale"]);
    return upsertLocaleMetadata(tx, ctx, locale, input);
  },
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof localeMetadataDeleteResponseSchema>
>({
  metadata: deleteLocaleMetadataMetadata,
  output: localeMetadataDeleteResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const locale = localeCodeSchema.parse(params["locale"]);
    return deleteLocaleMetadata(tx, ctx, locale);
  },
});
