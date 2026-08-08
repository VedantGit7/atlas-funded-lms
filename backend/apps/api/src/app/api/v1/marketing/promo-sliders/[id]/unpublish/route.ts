import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { z as zod } from "zod";
import { promoSliderResponseSchema } from "../../../../../../../server/marketing-promo-slider/marketing-promo-slider.schemas";
import { mutatePromoSlidersMetadata } from "../../../../../../../server/marketing-promo-slider/marketing-promo-slider.route-metadata";
import { unpublishPromoSlider } from "../../../../../../../server/marketing-promo-slider/marketing-promo-slider.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof promoSliderResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutatePromoSlidersMetadata,
  params: paramsSchema,
  body: noBodySchema,
  output: promoSliderResponseSchema,
  handler: async ({ tx, ctx, params }) => unpublishPromoSlider(tx, ctx, params.id),
});
