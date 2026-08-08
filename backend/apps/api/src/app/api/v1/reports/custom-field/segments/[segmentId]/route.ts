import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  customFieldSegmentDeleteResponseSchema,
  customFieldSegmentDetailResponseSchema,
  customFieldSegmentMutationResponseSchema,
  customFieldSegmentParamsSchema,
  updateCustomFieldSegmentBodySchema,
} from "@atlas/domain/reports/custom-field-segments.dto";
import {
  listCustomFieldSegmentsMetadata,
  mutateCustomFieldSegmentMetadata,
} from "@atlas/domain/reports/custom-field-segments.route-metadata";
import {
  deleteCustomFieldSegment,
  getCustomFieldSegment,
  updateCustomFieldSegment,
} from "@atlas/domain/reports/custom-field-segments.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldSegmentDetailResponseSchema>,
  typeof customFieldSegmentParamsSchema
>({
  metadata: listCustomFieldSegmentsMetadata,
  params: customFieldSegmentParamsSchema,
  output: customFieldSegmentDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getCustomFieldSegment(tx, ctx, params["segmentId"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateCustomFieldSegmentBodySchema>,
  z.output<typeof customFieldSegmentMutationResponseSchema>,
  typeof customFieldSegmentParamsSchema
>({
  metadata: mutateCustomFieldSegmentMetadata,
  params: customFieldSegmentParamsSchema,
  body: updateCustomFieldSegmentBodySchema,
  output: customFieldSegmentMutationResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateCustomFieldSegment(tx, ctx, params["segmentId"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldSegmentDeleteResponseSchema>,
  typeof customFieldSegmentParamsSchema
>({
  metadata: mutateCustomFieldSegmentMetadata,
  params: customFieldSegmentParamsSchema,
  output: customFieldSegmentDeleteResponseSchema,
  handler: async ({ tx, ctx, params }) => deleteCustomFieldSegment(tx, ctx, params["segmentId"]),
});
