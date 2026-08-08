import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import { JOB_STATUSES, type JobStatus } from "./reports.contract";
import {
  exportsHistoryListResponseSchema,
  type ExportsHistoryListQuery,
} from "./exports-roster.dto";
import {
  exportsRosterRepository,
  type ExportsHistoryRow,
} from "./exports-roster.repository";

function pageInfo(totalCount: number, page: number, limit: number) {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  return {
    page,
    pageSize: limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function asJobStatus(value: string): JobStatus {
  if ((JOB_STATUSES as readonly string[]).includes(value)) {
    return value as JobStatus;
  }
  return "FAILED";
}

function mapItem(row: ExportsHistoryRow) {
  const status = asJobStatus(row.status);
  const canDownload =
    status === "SUCCEEDED" &&
    (row.source_type === "report_run" || row.has_file);

  return {
    sourceType: row.source_type,
    id: row.id,
    definitionKey: row.definition_key,
    definitionTitle: row.definition_title,
    status,
    format: row.format,
    rowCount: row.row_count,
    requestedByName: row.requested_by_name,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    expiresAt: row.expires_at?.toISOString() ?? null,
    hasFile: row.has_file,
    canDownload,
  };
}

export async function listExportsHistory(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ExportsHistoryListQuery,
) {
  const [summary, rows] = await Promise.all([
    exportsRosterRepository.summarize(tx, query),
    exportsRosterRepository.listHistory(tx, query),
  ]);

  return exportsHistoryListResponseSchema.parse({
    data: {
      items: rows.map(mapItem),
      pageInfo: pageInfo(summary.totalCount, query.page, query.limit),
      columns: query.columns,
      summary: {
        totalCount: summary.totalCount,
        succeededCount: summary.succeededCount,
        failedCount: summary.failedCount,
        pendingCount: summary.pendingCount,
      },
    },
  });
}
