import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  deletePromoSliderBodySchema,
  deletePromoSliderResponseSchema,
} from "../../../../../../../server/marketing-promo-slider/marketing-promo-slider.schemas";
import { mutatePromoSlidersMetadata } from "../../../../../../../server/marketing-promo-slider/marketing-promo-slider.route-metadata";
import { deletePromoSlider } from "../../../../../../../server/marketing-promo-slider/marketing-promo-slider.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  z.output<typeof deletePromoSliderBodySchema>,
  z.output<typeof deletePromoSliderResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutatePromoSlidersMetadata,
  params: paramsSchema,
  body: deletePromoSliderBodySchema,
  output: deletePromoSliderResponseSchema,
  handler: async ({ tx, ctx, params, input }) => deletePromoSlider(tx, ctx, params["id"], input),
});
