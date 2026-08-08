import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  promoSliderResponseSchema,
  updatePromoSliderBasicsBodySchema,
} from "../../../../../../server/marketing-promo-slider/marketing-promo-slider.schemas";
import {
  listPromoSlidersMetadata,
  mutatePromoSlidersMetadata,
} from "../../../../../../server/marketing-promo-slider/marketing-promo-slider.route-metadata";
import {
  getPromoSlider,
  updatePromoSliderBasics,
} from "../../../../../../server/marketing-promo-slider/marketing-promo-slider.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof promoSliderResponseSchema>,
  typeof paramsSchema
>({
  metadata: listPromoSlidersMetadata,
  params: paramsSchema,
  output: promoSliderResponseSchema,
  handler: async ({ tx, ctx, params }) => getPromoSlider(tx, ctx, params["id"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updatePromoSliderBasicsBodySchema>,
  z.output<typeof promoSliderResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutatePromoSlidersMetadata,
  params: paramsSchema,
  body: updatePromoSliderBasicsBodySchema,
  output: promoSliderResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updatePromoSliderBasics(tx, ctx, params["id"], input),
});
