import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  localeCodeSchema,
  localeResourceUpsertResponseSchema,
  upsertLocaleResourcesBodySchema,
} from "../../../../../server/locales/locale.contract";
import { upsertLocaleResources } from "../../../../../server/locales/locale.service";
import { upsertLocaleResourcesMetadata } from "../../../../../server/locales/locale.route-metadata";

export const PUT = createTenantRoute<
  z.output<typeof upsertLocaleResourcesBodySchema>,
  z.output<typeof localeResourceUpsertResponseSchema>
>({
  metadata: upsertLocaleResourcesMetadata,
  body: upsertLocaleResourcesBodySchema,
  output: localeResourceUpsertResponseSchema,
  handler: async ({ tx, ctx, input, params }) => {
    const locale = localeCodeSchema.parse(params["locale"]);
    return upsertLocaleResources(tx, ctx, locale, input);
  },
});
