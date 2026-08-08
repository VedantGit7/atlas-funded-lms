import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { customFieldDefinitionsReportResponseSchema } from "@atlas/domain/reports/custom-field-roster.dto";
import { listCustomFieldRosterMetadata } from "@atlas/domain/reports/custom-field-roster.route-metadata";
import { listCustomFieldDefinitionsForReport } from "@atlas/domain/reports/custom-field-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldDefinitionsReportResponseSchema>
>({
  metadata: listCustomFieldRosterMetadata,
  input: noBodySchema,
  output: customFieldDefinitionsReportResponseSchema,
  handler: async ({ tx, ctx }) => listCustomFieldDefinitionsForReport(tx, ctx),
});
