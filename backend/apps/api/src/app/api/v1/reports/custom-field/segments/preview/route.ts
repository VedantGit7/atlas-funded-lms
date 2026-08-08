import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  customFieldSegmentPreviewResponseSchema,
  previewCustomFieldSegmentBodySchema,
} from "@atlas/domain/reports/custom-field-segments.dto";
import { previewCustomFieldSegmentMetadata } from "@atlas/domain/reports/custom-field-segments.route-metadata";
import { previewCustomFieldSegment } from "@atlas/domain/reports/custom-field-segments.service";

export const POST = createTenantRoute<
  z.output<typeof previewCustomFieldSegmentBodySchema>,
  z.output<typeof customFieldSegmentPreviewResponseSchema>
>({
  metadata: previewCustomFieldSegmentMetadata,
  body: previewCustomFieldSegmentBodySchema,
  output: customFieldSegmentPreviewResponseSchema,
  handler: async ({ tx, ctx, input }) => previewCustomFieldSegment(tx, ctx, input),
});
