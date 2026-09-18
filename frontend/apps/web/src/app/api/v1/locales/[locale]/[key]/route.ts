import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  localeCodeSchema,
  localeResourceKeySchema,
  deleteLocaleResourceResponseSchema,
} from "../../../../../../server/locales/locale.contract";
import { deleteLocaleResource } from "../../../../../../server/locales/locale.service";
import { deleteLocaleResourceMetadata } from "../../../../../../server/locales/locale.route-metadata";

// Without a `params` schema the handler received `Record<string, never>`, so
// `params["key"]` was `undefined` at the type level and fell back to "".
const paramsSchema = z.object({ locale: z.string().min(1), key: z.string().min(1) });

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteLocaleResourceResponseSchema>,
  typeof paramsSchema
>({
  metadata: deleteLocaleResourceMetadata,
  params: paramsSchema,
  output: deleteLocaleResourceResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const locale = localeCodeSchema.parse(params.locale);
    const key = localeResourceKeySchema.parse(decodeURIComponent(params.key));
    return deleteLocaleResource(tx, ctx, locale, key);
  },
});
