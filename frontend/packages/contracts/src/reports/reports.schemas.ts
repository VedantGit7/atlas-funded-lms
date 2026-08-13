import { z } from "zod";

export const reportParamSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["date", "string", "select"]),
  required: z.boolean().default(false),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  defaultValue: z.string().optional(),
});

export const reportDefinitionSchema = z.object({
  id: z.string(),
  category: z.string(),
  name: z.string(),
  description: z.string(),
  defaultViz: z.enum([
    "kpi",
    "table",
    "pivot",
    "line",
    "area",
    "bar",
    "combo",
    "pie",
    "donut",
    "funnel",
    "progress",
    "scatter",
    "heatmap",
    "sparkline",
  ]),
  params: z.array(reportParamSchema),
});

export const normalizedColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(["dimension", "measure", "string", "number", "date"]),
});

export const normalizedResultSchema = z.object({
  columns: z.array(normalizedColumnSchema),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  dimensions: z.array(z.string()).optional(),
  measures: z.array(z.string()).optional(),
  series: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
});

export const reportDefinitionsQuerySchema = z
  .object({
    category: z.string().min(1),
  })
  .strict();

export const reportDefinitionsResponseSchema = z.object({
  data: z.object({
    category: z.string(),
    definitions: z.array(reportDefinitionSchema),
  }),
});

export const startReportRunBodySchema = z
  .object({
    definitionId: z.string().min(1),
    params: z.record(z.string(), z.string()).default({}),
  })
  .strict();

export const reportRunSchema = z.object({
  id: z.uuid(),
  definitionId: z.string(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
});

export const reportRunResponseSchema = z.object({
  data: reportRunSchema,
});

export const reportPreviewResponseSchema = z.object({
  data: z.object({
    runId: z.uuid(),
    defaultViz: reportDefinitionSchema.shape.defaultViz,
    preview: normalizedResultSchema,
  }),
});

export const reportSchedulesQuerySchema = z
  .object({
    category: z.string().min(1),
  })
  .strict();

export const reportScheduleSchema = z.object({
  id: z.uuid(),
  definitionId: z.string(),
  name: z.string(),
  cadence: z.enum(["daily", "weekly", "monthly"]),
  nextRunAt: z.string(),
  format: z.enum(["csv", "xlsx", "pdf"]),
  active: z.boolean(),
});

export const reportSchedulesResponseSchema = z.object({
  data: z.object({
    category: z.string(),
    schedules: z.array(reportScheduleSchema),
  }),
});

export const reportHistoryQuerySchema = z
  .object({
    category: z.string().min(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const reportHistoryItemSchema = z.object({
  id: z.uuid(),
  definitionId: z.string(),
  definitionName: z.string(),
  status: reportRunSchema.shape.status,
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

export const reportHistoryResponseSchema = z.object({
  data: z.object({
    category: z.string(),
    items: z.array(reportHistoryItemSchema),
  }),
});

export type ReportDefinition = z.infer<typeof reportDefinitionSchema>;
export type NormalizedResult = z.infer<typeof normalizedResultSchema>;
export type ReportRunRecord = z.infer<typeof reportRunSchema> & {
  tenantId: string;
  category: string;
  preview: NormalizedResult;
};
