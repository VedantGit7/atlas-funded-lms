import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  localeCodeSchema,
  localeResourceKeySchema,
  deleteLocaleResourceResponseSchema,
} from "../../../../../../server/locales/locale.contract";
import { deleteLocaleResource } from "../../../../../../server/locales/locale.service";
import { deleteLocaleResourceMetadata } from "../../../../../../server/locales/locale.route-metadata";

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteLocaleResourceResponseSchema>
>({
  metadata: deleteLocaleResourceMetadata,
  output: deleteLocaleResourceResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const locale = localeCodeSchema.parse(params["locale"]);
    const key = localeResourceKeySchema.parse(decodeURIComponent(params["key"] ?? ""));
    return deleteLocaleResource(tx, ctx, locale, key);
  },
});
