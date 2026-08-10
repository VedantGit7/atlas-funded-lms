import { z } from "zod";
import { REPORT_FORMATS } from "./reports.contract";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const exportBuilderPreviewBodySchema = rejectClientTenantFields
  .extend({
    definitionKey: z.string().trim().min(1).max(120),
    params: z.record(z.unknown()).default({}),
    columns: z.array(z.string().min(1)).max(80).optional(),
    format: z.enum(REPORT_FORMATS).optional(),
    rowLimit: z.coerce.number().int().min(1).max(10_000).optional(),
    sampleLimit: z.coerce.number().int().min(1).max(25).default(10),
  })
  .strict();

export type ExportBuilderPreviewBody = z.output<typeof exportBuilderPreviewBodySchema>;

export const exportBuilderPreviewResponseSchema = z.object({
  data: z
    .object({
      definitionKey: z.string(),
      definitionTitle: z.string(),
      datasetKey: z.string(),
      estimatedRowCount: z.number().int().nonnegative(),
      capped: z.boolean(),
      rowCap: z.number().int().positive(),
      estimatedSizeLabel: z.string().nullable(),
      columns: z.array(z.string()),
      piiColumns: z.array(z.string()),
      sampleRows: z.array(z.record(z.unknown())),
      sampleLimit: z.number().int().positive(),
    })
    .strict(),
});
