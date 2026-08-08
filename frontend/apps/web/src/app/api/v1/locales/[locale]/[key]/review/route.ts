import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  localeCodeSchema,
  localeResourceKeySchema,
  localeReviewUpdateResponseSchema,
  updateLocaleReviewBodySchema,
} from "../../../../../../../server/locales/locale.contract";
import { updateLocaleReview } from "../../../../../../../server/locales/locale.service";
import { updateLocaleReviewMetadata } from "../../../../../../../server/locales/locale.route-metadata";

export const PUT = createTenantRoute<
  z.output<typeof updateLocaleReviewBodySchema>,
  z.output<typeof localeReviewUpdateResponseSchema>
>({
  metadata: updateLocaleReviewMetadata,
  body: updateLocaleReviewBodySchema,
  output: localeReviewUpdateResponseSchema,
  handler: async ({ tx, ctx, input, params }) => {
    const locale = localeCodeSchema.parse(params["locale"]);
    const key = localeResourceKeySchema.parse(decodeURIComponent(params["key"] ?? ""));
    return updateLocaleReview(tx, ctx, locale, key, input);
  },
});
