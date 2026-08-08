import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  customFieldSegmentLearnersExportResponseSchema,
  customFieldSegmentParamsSchema,
} from "@atlas/domain/reports/custom-field-segments.dto";
import { exportCustomFieldSegmentsMetadata } from "@atlas/domain/reports/custom-field-segments.route-metadata";
import { exportCustomFieldSegmentLearnersCsv } from "@atlas/domain/reports/custom-field-segments.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldSegmentLearnersExportResponseSchema>,
  typeof customFieldSegmentParamsSchema
>({
  metadata: exportCustomFieldSegmentsMetadata,
  params: customFieldSegmentParamsSchema,
  output: customFieldSegmentLearnersExportResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    exportCustomFieldSegmentLearnersCsv(tx, ctx, params.segmentId),
});
