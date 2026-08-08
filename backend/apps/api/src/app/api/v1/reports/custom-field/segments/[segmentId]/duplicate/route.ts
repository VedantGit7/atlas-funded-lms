import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  customFieldSegmentMutationResponseSchema,
  customFieldSegmentParamsSchema,
} from "@atlas/domain/reports/custom-field-segments.dto";
import { mutateCustomFieldSegmentMetadata } from "@atlas/domain/reports/custom-field-segments.route-metadata";
import { duplicateCustomFieldSegment } from "@atlas/domain/reports/custom-field-segments.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldSegmentMutationResponseSchema>,
  typeof customFieldSegmentParamsSchema
>({
  metadata: mutateCustomFieldSegmentMetadata,
  params: customFieldSegmentParamsSchema,
  output: customFieldSegmentMutationResponseSchema,
  handler: async ({ tx, ctx, params }) => duplicateCustomFieldSegment(tx, ctx, params["segmentId"]),
});
