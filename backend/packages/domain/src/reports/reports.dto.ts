import { z } from "zod";
import { JOB_STATUSES, REPORT_FORMATS } from "./reports.contract";

const rejectClientTenantFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    filter: z.never().optional(),
    sort: z.never().optional(),
    offset: z.never().optional(),
    r2_key: z.never().optional(),
    r2_object_key: z.never().optional(),
    object_key: z.never().optional(),
  })
  .loose();

export const reportParamsSchema = z.record(z.string(), z.unknown()).default({});

export const reportListQuerySchema = rejectClientTenantFields
  .extend({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(JOB_STATUSES).optional(),
    definitionKey: z.string().min(1).optional(),
  })
  .strict();

export const reportRunParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const createReportRunBodySchema = rejectClientTenantFields
  .extend({
    definitionKey: z.string().min(1),
    format: z.enum(REPORT_FORMATS).optional(),
    params: reportParamsSchema.optional(),
  })
  .strict();

export const reportDefinitionDtoSchema = z
  .object({
    id: z.uuid(),
    key: z.string(),
    category: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    paramSchema: z.record(z.string(), z.unknown()),
    datasetKey: z.string(),
    columns: z.array(z.string()).optional(),
    defaultFormat: z.enum(REPORT_FORMATS),
    scope: z.enum(["system", "tenant"]),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const reportRunDtoSchema = z
  .object({
    id: z.uuid(),
    definitionKey: z.string(),
    definitionTitle: z.string(),
    status: z.enum(JOB_STATUSES),
    format: z.enum(REPORT_FORMATS),
    params: z.record(z.string(), z.unknown()),
    rowCount: z.number().int().nullable(),
    progressPercent: z.number().int().min(0).max(100).nullable(),
    requestedByMembershipId: z.uuid(),
    scheduleId: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    expiresAt: z.iso.datetime().nullable(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    errorTrace: z.array(z.string()).nullable(),
    download: z
      .object({
        url: z.url(),
        expiresAt: z.iso.datetime(),
      })
      .nullable(),
  })
  .strict();

export const reportRunListResponseSchema = z.object({
  data: z.object({
    items: z.array(reportRunDtoSchema.omit({ download: true })),
    pageInfo: z.object({
      nextCursor: z.uuid().nullable(),
      hasNextPage: z.boolean(),
    }),
  }),
});

export const createReportRunResponseSchema = z.object({
  data: reportRunDtoSchema.omit({ download: true }),
});

export const reportRunDetailResponseSchema = z.object({
  data: reportRunDtoSchema,
});

export const reportDefinitionListResponseSchema = z.object({
  data: z.object({
    items: z.array(reportDefinitionDtoSchema),
  }),
});

export const createCustomReportDefinitionBodySchema = rejectClientTenantFields
  .extend({
    title: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    datasetKey: z.string().min(1),
    columns: z.array(z.string().min(1)).min(1),
    key: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/, "Key must use lowercase letters, numbers, and hyphens.")
      .optional(),
  })
  .strict();

export const createCustomReportDefinitionResponseSchema = z.object({
  data: reportDefinitionDtoSchema,
});

export const reportScheduleParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const createReportScheduleBodySchema = rejectClientTenantFields
  .extend({
    definitionKey: z.string().min(1),
    name: z.string().max(120).optional(),
    cronExpression: z.string().min(1).max(120),
    timezone: z.string().min(1).max(64).default("UTC"),
    params: reportParamsSchema.optional(),
    formats: z.array(z.enum(REPORT_FORMATS)).min(1).default(["csv"]),
    delivery: z.record(z.string(), z.unknown()).optional(),
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateReportScheduleBodySchema = rejectClientTenantFields
  .extend({
    name: z.string().max(120).optional(),
    cronExpression: z.string().min(1).max(120).optional(),
    timezone: z.string().min(1).max(64).optional(),
    params: reportParamsSchema.optional(),
    formats: z.array(z.enum(REPORT_FORMATS)).min(1).optional(),
    delivery: z.record(z.string(), z.unknown()).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const reportScheduleDtoSchema = z
  .object({
    id: z.uuid(),
    definitionKey: z.string(),
    definitionTitle: z.string(),
    name: z.string().nullable(),
    cronExpression: z.string(),
    timezone: z.string(),
    params: z.record(z.string(), z.unknown()),
    formats: z.array(z.enum(REPORT_FORMATS)),
    delivery: z.record(z.string(), z.unknown()).nullable(),
    nextRunAt: z.iso.datetime(),
    isActive: z.boolean(),
    createdByMembershipId: z.uuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const reportScheduleListResponseSchema = z.object({
  data: z.object({
    items: z.array(reportScheduleDtoSchema),
  }),
});

export const createReportScheduleResponseSchema = z.object({
  data: reportScheduleDtoSchema,
});

export const updateReportScheduleResponseSchema = z.object({
  data: reportScheduleDtoSchema,
});

export const deleteReportScheduleResponseSchema = z.object({
  data: z.object({
    deleted: z.literal(true),
    id: z.uuid(),
  }),
});

export const reportTickResponseSchema = z.object({
  data: z.object({
    tenantsProcessed: z.number().int(),
    schedulesClaimed: z.number().int(),
    runsEnqueued: z.number().int(),
  }),
});

export type ReportListQuery = z.output<typeof reportListQuerySchema>;
export type CreateReportRunBody = z.output<typeof createReportRunBodySchema>;
export type CreateCustomReportDefinitionBody = z.output<
  typeof createCustomReportDefinitionBodySchema
>;
export type CreateReportScheduleBody = z.output<typeof createReportScheduleBodySchema>;
export type UpdateReportScheduleBody = z.output<typeof updateReportScheduleBodySchema>;
