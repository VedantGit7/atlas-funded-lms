import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  customFieldSegmentParamsSchema,
  customFieldSegmentViewResponseSchema,
} from "@atlas/domain/reports/custom-field-segments.dto";
import { listCustomFieldSegmentsMetadata } from "@atlas/domain/reports/custom-field-segments.route-metadata";
import { getCustomFieldSegmentView } from "@atlas/domain/reports/custom-field-segments.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldSegmentViewResponseSchema>,
  typeof customFieldSegmentParamsSchema
>({
  metadata: listCustomFieldSegmentsMetadata,
  params: customFieldSegmentParamsSchema,
  output: customFieldSegmentViewResponseSchema,
  handler: async ({ tx, ctx, params }) => getCustomFieldSegmentView(tx, ctx, params.segmentId),
});
