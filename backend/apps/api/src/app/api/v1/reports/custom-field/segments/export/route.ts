import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { customFieldSegmentExportResponseSchema } from "@atlas/domain/reports/custom-field-segments.dto";
import { exportCustomFieldSegmentsMetadata } from "@atlas/domain/reports/custom-field-segments.route-metadata";
import { exportCustomFieldSegmentsCsv } from "@atlas/domain/reports/custom-field-segments.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldSegmentExportResponseSchema>
>({
  metadata: exportCustomFieldSegmentsMetadata,
  output: customFieldSegmentExportResponseSchema,
  handler: async ({ tx, ctx }) => exportCustomFieldSegmentsCsv(tx, ctx),
});
