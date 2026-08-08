import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createCustomFieldSegmentBodySchema,
  customFieldSegmentListResponseSchema,
  customFieldSegmentMutationResponseSchema,
} from "@atlas/domain/reports/custom-field-segments.dto";
import {
  listCustomFieldSegmentsMetadata,
  mutateCustomFieldSegmentMetadata,
} from "@atlas/domain/reports/custom-field-segments.route-metadata";
import {
  createCustomFieldSegment,
  listCustomFieldSegments,
} from "@atlas/domain/reports/custom-field-segments.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldSegmentListResponseSchema>
>({
  metadata: listCustomFieldSegmentsMetadata,
  output: customFieldSegmentListResponseSchema,
  handler: async ({ tx, ctx }) => listCustomFieldSegments(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createCustomFieldSegmentBodySchema>,
  z.output<typeof customFieldSegmentMutationResponseSchema>
>({
  metadata: mutateCustomFieldSegmentMetadata,
  body: createCustomFieldSegmentBodySchema,
  output: customFieldSegmentMutationResponseSchema,
  handler: async ({ tx, ctx, input }) => createCustomFieldSegment(tx, ctx, input),
});
