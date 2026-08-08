import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  promoSliderResponseSchema,
  replacePromoSlidesBodySchema,
} from "../../../../../../../server/marketing-promo-slider/marketing-promo-slider.schemas";
import { mutatePromoSlidersMetadata } from "../../../../../../../server/marketing-promo-slider/marketing-promo-slider.route-metadata";
import { replacePromoSlides } from "../../../../../../../server/marketing-promo-slider/marketing-promo-slider.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const PUT = createTenantRoute<
  z.output<typeof replacePromoSlidesBodySchema>,
  z.output<typeof promoSliderResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutatePromoSlidersMetadata,
  params: paramsSchema,
  body: replacePromoSlidesBodySchema,
  output: promoSliderResponseSchema,
  handler: async ({ tx, ctx, params, input }) => replacePromoSlides(tx, ctx, params.id, input),
});
