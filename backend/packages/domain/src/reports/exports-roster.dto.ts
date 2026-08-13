import { z } from "zod";
import { JOB_STATUSES, REPORT_FORMATS } from "./reports.contract";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const EXPORTS_HISTORY_COLUMNS = [
  "source_type",
  "id",
  "definition_key",
  "definition_title",
  "status",
  "format",
  "row_count",
  "requested_by_name",
  "created_at",
  "completed_at",
  "expires_at",
  "has_file",
] as const;

export type ExportsHistoryColumn = (typeof EXPORTS_HISTORY_COLUMNS)[number];

export const EXPORTS_FILE_STATES = ["available", "removed", "expired", "expiring_soon"] as const;

export type ExportsFileState = (typeof EXPORTS_FILE_STATES)[number];

function parseColumns(allowed: readonly string[], value: unknown): string[] {
  const allowedSet = new Set<string>(allowed);
  if (Array.isArray(value)) {
    const selected = value.filter(
      (column): column is string => typeof column === "string" && allowedSet.has(column),
    );
    return selected.length > 0 ? selected : [...allowed];
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return [...allowed];
  }
  const selected = value
    .split(",")
    .map((part) => part.trim())
    .filter((column) => allowedSet.has(column));
  return selected.length > 0 ? selected : [...allowed];
}

const pageInfoSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const exportsHistoryListQuerySchema = rejectClientTenantFields
  .extend({
    sourceType: z.enum(["report_run", "export_job"]).optional(),
    status: z.enum(JOB_STATUSES).optional(),
    definitionKey: z.string().trim().min(1).max(120).optional(),
    format: z.enum(REPORT_FORMATS).optional(),
    fileState: z.enum(EXPORTS_FILE_STATES).optional(),
    mine: z
      .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (typeof value === "boolean") return value;
        return value === "true" || value === "1";
      }),
    pendingOnly: z
      .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (typeof value === "boolean") return value;
        return value === "true" || value === "1";
      }),
    createdFrom: z.iso.datetime().optional(),
    createdTo: z.iso.datetime().optional(),
    q: z.string().trim().min(1).max(200).optional(),
    columns: z.preprocess(
      (value) => parseColumns(EXPORTS_HISTORY_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ExportsHistoryListQuery = z.output<typeof exportsHistoryListQuerySchema>;

export const exportsHistoryItemSchema = z
  .object({
    sourceType: z.enum(["report_run", "export_job"]),
    id: z.uuid(),
    definitionKey: z.string().nullable(),
    definitionTitle: z.string().nullable(),
    status: z.enum(JOB_STATUSES),
    format: z.string().nullable(),
    rowCount: z.number().int().nullable(),
    requestedByName: z.string().nullable(),
    createdAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    expiresAt: z.iso.datetime().nullable(),
    hasFile: z.boolean(),
    canDownload: z.boolean(),
    progressPercent: z.number().int().min(0).max(100).nullable(),
    errorMessage: z.string().nullable(),
  })
  .strict();

export const exportsHistoryListResponseSchema = z.object({
  data: z.object({
    items: z.array(exportsHistoryItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
    summary: z.object({
      totalCount: z.number().int().nonnegative(),
      succeededCount: z.number().int().nonnegative(),
      failedCount: z.number().int().nonnegative(),
      pendingCount: z.number().int().nonnegative(),
      filesAvailableCount: z.number().int().nonnegative(),
      expiringSoonCount: z.number().int().nonnegative(),
      oldestPendingTitle: z.string().nullable(),
    }),
  }),
});

export const exportExportsHistoryBodySchema = rejectClientTenantFields
  .extend({
    sourceType: z.enum(["report_run", "export_job"]).optional(),
    status: z.enum(JOB_STATUSES).optional(),
    definitionKey: z.string().trim().min(1).max(120).optional(),
    format: z.enum(REPORT_FORMATS).optional(),
    fileState: z.enum(EXPORTS_FILE_STATES).optional(),
    mine: z.boolean().optional(),
    pendingOnly: z.boolean().optional(),
    createdFrom: z.iso.datetime().optional(),
    createdTo: z.iso.datetime().optional(),
    q: z.string().trim().min(1).max(200).optional(),
    columns: z.array(z.string().min(1)).min(1).max(30).optional(),
    emailDownloadLink: z.boolean().default(true),
  })
  .strict();

export const exportExportsHistoryResponseSchema = z.object({
  data: z.object({
    runId: z.uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});

export { REPORT_FORMATS };
