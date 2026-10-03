"use client";

import { clientApi } from "../../../lib/client-api";

export type ExportRunPipelineStage = {
  key: "queued" | "started" | "query" | "serialize" | "upload" | "delivered";
  label: string;
  state: "complete" | "current" | "failed" | "pending" | "skipped";
  at: string | null;
};

export type ExportRunDetail = {
  sourceType: "report_run" | "export_job";
  id: string;
  fileName: string;
  definitionKey: string | null;
  definitionTitle: string | null;
  status: string;
  format: string | null;
  params: Record<string, unknown>;
  filterChips: string[];
  columnChips: string[];
  columnsTotal: number;
  sortLabel: string | null;
  rowLimitLabel: string | null;
  delivery: {
    kind: "download_only" | "email" | "webhook" | "storage";
    label: string;
    recipients: string[];
    status: string | null;
    deliveredAt: string | null;
    error: string | null;
  };
  rowCount: number | null;
  progressPercent: number | null;
  estimatedSizeLabel: string | null;
  containsPersonalData: boolean;
  requestedByName: string | null;
  requestedByEmail: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
  durationSeconds: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorTrace: string[] | null;
  failedStage: ExportRunPipelineStage["key"] | null;
  failureHint: string | null;
  pipeline: ExportRunPipelineStage[];
  hasFile: boolean;
  canDownload: boolean;
  canDeleteFile: boolean;
  canCancel: boolean;
  canRetry: boolean;
  download: { url: string; expiresAt: string } | null;
  accessLog: Array<{
    id: string;
    actorName: string;
    actorEmail: string | null;
    action: string;
    ipAddress: string | null;
    at: string;
  }>;
  accessLogAvailable: boolean;
};

export async function fetchExportRunDetail(
  runId: string,
  sourceType?: "report_run" | "export_job",
) {
  const query = sourceType ? `?sourceType=${encodeURIComponent(sourceType)}` : "";
  return clientApi.get<{ data: ExportRunDetail }>(
    `/api/v1/reports/exports/${encodeURIComponent(runId)}${query}`,
  );
}

export async function deleteExportRunFile(runId: string, sourceType?: "report_run" | "export_job") {
  return clientApi.post<{
    data: { id: string; sourceType: string; deleted: false; hasFile: true; deletionPending: true };
  }>(
    `/api/v1/reports/exports/${encodeURIComponent(runId)}/file`,
    sourceType ? { sourceType } : {},
    `export-run-delete-file-${runId}`,
    { successMessage: "Export file deleted." },
  );
}

export async function cancelExportRun(runId: string, sourceType?: "report_run" | "export_job") {
  return clientApi.post<{ data: { id: string; sourceType: string; status: "CANCELLED" } }>(
    `/api/v1/reports/exports/${encodeURIComponent(runId)}/cancel`,
    sourceType ? { sourceType } : {},
    `export-run-cancel-${runId}`,
    { successMessage: "Export run cancelled." },
  );
}

export async function retryExportRun(runId: string, sourceType?: "report_run" | "export_job") {
  return clientApi.post<{ data: { id: string; sourceType: string; status: string } }>(
    `/api/v1/reports/exports/${encodeURIComponent(runId)}/retry`,
    sourceType ? { sourceType } : {},
    `export-run-retry-${runId}`,
    { successMessage: "Export re-queued." },
  );
}
