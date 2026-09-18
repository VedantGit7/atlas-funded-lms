import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  localeCodeSchema,
  localeResourceKeySchema,
  localeReviewUpdateResponseSchema,
  updateLocaleReviewBodySchema,
} from "../../../../../../../server/locales/locale.contract";
import { updateLocaleReview } from "../../../../../../../server/locales/locale.service";
import { updateLocaleReviewMetadata } from "../../../../../../../server/locales/locale.route-metadata";

// Without a `params` schema the handler received `Record<string, never>`, so
// `params["key"]` was `undefined` at the type level and fell back to "".
const paramsSchema = z.object({ locale: z.string().min(1), key: z.string().min(1) });

export const PUT = createTenantRoute<
  z.output<typeof updateLocaleReviewBodySchema>,
  z.output<typeof localeReviewUpdateResponseSchema>,
  typeof paramsSchema
>({
  metadata: updateLocaleReviewMetadata,
  params: paramsSchema,
  body: updateLocaleReviewBodySchema,
  output: localeReviewUpdateResponseSchema,
  handler: async ({ tx, ctx, input, params }) => {
    const locale = localeCodeSchema.parse(params.locale);
    const key = localeResourceKeySchema.parse(decodeURIComponent(params.key));
    return updateLocaleReview(tx, ctx, locale, key, input);
  },
});
