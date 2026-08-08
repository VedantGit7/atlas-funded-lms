import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  customFieldDetailParamsSchema,
  customFieldDetailQuerySchema,
  customFieldDetailResponseSchema,
} from "@atlas/domain/reports/custom-field-roster.dto";
import { listCustomFieldRosterMetadata } from "@atlas/domain/reports/custom-field-roster.route-metadata";
import { getCustomFieldDetail } from "@atlas/domain/reports/custom-field-roster.service";

export const GET = createTenantRoute<
  z.output<typeof customFieldDetailQuerySchema>,
  z.output<typeof customFieldDetailResponseSchema>,
  typeof customFieldDetailParamsSchema
>({
  metadata: listCustomFieldRosterMetadata,
  params: customFieldDetailParamsSchema,
  input: customFieldDetailQuerySchema,
  output: customFieldDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    getCustomFieldDetail(tx, ctx, params.fieldKey, input),
});
