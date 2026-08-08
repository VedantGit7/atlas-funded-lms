import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  customFieldSegmentLearnersQuerySchema,
  customFieldSegmentLearnersResponseSchema,
  customFieldSegmentParamsSchema,
} from "@atlas/domain/reports/custom-field-segments.dto";
import { listCustomFieldSegmentsMetadata } from "@atlas/domain/reports/custom-field-segments.route-metadata";
import { listCustomFieldSegmentLearners } from "@atlas/domain/reports/custom-field-segments.service";

export const GET = createTenantRoute<
  z.output<typeof customFieldSegmentLearnersQuerySchema>,
  z.output<typeof customFieldSegmentLearnersResponseSchema>,
  typeof customFieldSegmentParamsSchema
>({
  metadata: listCustomFieldSegmentsMetadata,
  params: customFieldSegmentParamsSchema,
  input: customFieldSegmentLearnersQuerySchema,
  output: customFieldSegmentLearnersResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    listCustomFieldSegmentLearners(tx, ctx, params.segmentId, input),
});
