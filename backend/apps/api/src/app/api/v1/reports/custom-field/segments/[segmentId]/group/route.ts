import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createSegmentGroupBodySchema,
  customFieldSegmentGroupResponseSchema,
  customFieldSegmentParamsSchema,
} from "@atlas/domain/reports/custom-field-segments.dto";
import { mutateCustomFieldSegmentMetadata } from "@atlas/domain/reports/custom-field-segments.route-metadata";
import { createGroupFromCustomFieldSegment } from "@atlas/domain/reports/custom-field-segments.service";

export const POST = createTenantRoute<
  z.output<typeof createSegmentGroupBodySchema>,
  z.output<typeof customFieldSegmentGroupResponseSchema>,
  typeof customFieldSegmentParamsSchema
>({
  metadata: mutateCustomFieldSegmentMetadata,
  params: customFieldSegmentParamsSchema,
  body: createSegmentGroupBodySchema,
  output: customFieldSegmentGroupResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    createGroupFromCustomFieldSegment(tx, ctx, params["segmentId"], input),
});
