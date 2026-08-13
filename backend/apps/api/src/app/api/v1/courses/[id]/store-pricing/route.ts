import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  iapCourseIdParamsSchema,
  courseStorePricingResponseSchema,
} from "@atlas/domain/iap/iap.dto";
import { getCourseStorePricingMetadata } from "@atlas/domain/iap/iap.route-metadata";
import { getCourseStorePricing } from "@atlas/domain/iap/iap.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof courseStorePricingResponseSchema>,
  typeof iapCourseIdParamsSchema
>({
  metadata: getCourseStorePricingMetadata,
  params: iapCourseIdParamsSchema,
  output: courseStorePricingResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return getCourseStorePricing(tx, ctx, courseId);
  },
});
