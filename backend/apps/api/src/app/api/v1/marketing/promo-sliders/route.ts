import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createPromoSliderBodySchema,
  promoSliderResponseSchema,
  promoSlidersListQuerySchema,
  promoSlidersListResponseSchema,
} from "../../../../../server/marketing-promo-slider/marketing-promo-slider.schemas";
import {
  listPromoSlidersMetadata,
  mutatePromoSlidersMetadata,
} from "../../../../../server/marketing-promo-slider/marketing-promo-slider.route-metadata";
import {
  createPromoSlider,
  listPromoSliders,
} from "../../../../../server/marketing-promo-slider/marketing-promo-slider.service";

export const GET = createTenantRoute<
  z.output<typeof promoSlidersListQuerySchema>,
  z.output<typeof promoSlidersListResponseSchema>
>({
  metadata: listPromoSlidersMetadata,
  input: promoSlidersListQuerySchema,
  output: promoSlidersListResponseSchema,
  handler: async ({ tx, ctx, input }) => listPromoSliders(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createPromoSliderBodySchema>,
  z.output<typeof promoSliderResponseSchema>
>({
  metadata: mutatePromoSlidersMetadata,
  body: createPromoSliderBodySchema,
  output: promoSliderResponseSchema,
  handler: async ({ tx, ctx, input }) => createPromoSlider(tx, ctx, input),
});
