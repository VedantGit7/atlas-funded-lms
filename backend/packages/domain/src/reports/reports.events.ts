import { z } from "zod";

export const REPORT_GENERATE_REQUESTED_EVENT = "report.generate_requested" as const;
export const REPORT_RUN_SUCCEEDED_EVENT = "report.run_succeeded" as const;
export const REPORT_GENERATE_WORKER_DESTINATION = "reports.generate" as const;
export const REPORT_DELIVERY_WORKER_DESTINATION = "reports.delivery" as const;

export const REPORT_GENERATE_REQUESTED_AUDIT = "report.generate.requested" as const;
export const REPORT_SCHEDULE_CREATED_AUDIT = "report.schedule.created" as const;
export const REPORT_SCHEDULE_UPDATED_AUDIT = "report.schedule.updated" as const;
export const REPORT_SCHEDULE_DELETED_AUDIT = "report.schedule.deleted" as const;

export const reportGenerateRequestedPayloadSchema = z
  .object({
    reportRunId: z.uuid(),
    reportDefinitionKey: z.string().min(1),
    requestedAt: z.iso.datetime(),
    requestedByMembershipId: z.uuid(),
    format: z.enum(["csv", "xlsx", "pdf", "json"]),
    schemaVersion: z.literal(1),
  })
  .strict();

export type ReportGenerateRequestedPayload = z.output<typeof reportGenerateRequestedPayloadSchema>;

export const reportRunSucceededPayloadSchema = z
  .object({
    reportRunId: z.uuid(),
    reportDefinitionKey: z.string().min(1),
    format: z.enum(["csv", "xlsx", "pdf", "json"]),
    rowCount: z.number().int().nonnegative(),
    completedAt: z.iso.datetime(),
    schemaVersion: z.literal(1),
  })
  .strict();

export type ReportRunSucceededPayload = z.output<typeof reportRunSucceededPayloadSchema>;
