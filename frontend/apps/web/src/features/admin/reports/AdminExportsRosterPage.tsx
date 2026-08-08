"use client";

import { useCallback, useEffect, useState } from "react";
import {
  analyticsAlertErrorClassName,
  analyticsExportButtonClassName,
  analyticsTableHeadClassName,
  analyticsTableRowClassName,
  analyticsTableShellClassName,
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  generalSettingsFormCardClassName,
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";
import { ClientApiError } from "../../../lib/client-api";
import { fetchExportJob } from "../../data-rights/api";
import {
  EXPORTS_HISTORY_COLUMN_OPTIONS,
  dateInputToEndIso,
  dateInputToStartIso,
  exportExportsHistoryReport,
  fetchExportsHistory,
  type ExportsHistoryColumnKey,
  type ExportsHistoryItem,
  type ExportsHistorySummary,
} from "./admin-exports-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { BiExportPanel } from "./BiExportPanel";
import { CustomReportBuilder } from "./CustomReportBuilder";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AdminExportsRosterPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<ExportsHistoryItem[]>([]);
  const [summary, setSummary] = useState<ExportsHistorySummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [searchQ, setSearchQ] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [status, setStatus] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [columns, setColumns] = useState<ExportsHistoryColumnKey[]>([
    "source_type",
    "definition_title",
    "status",
    "format",
    "row_count",
    "requested_by_name",
    "created_at",
  ]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = dateInputToStartIso(createdFrom);
      const to = dateInputToEndIso(createdTo);
      const response = await fetchExportsHistory({
        ...(searchQ.trim() ? { q: searchQ.trim() } : {}),
        ...(sourceType ? { sourceType } : {}),
        ...(status ? { status } : {}),
        ...(from ? { createdFrom: from } : {}),
        ...(to ? { createdTo: to } : {}),
        columns,
        page,
      });
      setItems(response.data.items);
      setSummary(response.data.summary);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load Export History.",
      );
      setItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [columns, createdFrom, createdTo, page, searchQ, sourceType, status]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  function toggleColumn(key: ExportsHistoryColumnKey) {
    setColumns((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((column) => column !== key);
      }
      return [...current, key];
    });
  }

  async function handleDownload(item: ExportsHistoryItem) {
    if (!item.canDownload) return;
    setDownloadingId(item.id);
    setError(null);
    try {
      if (item.sourceType === "report_run") {
        const format =
          item.format === "xlsx" || item.format === "pdf" || item.format === "csv"
            ? item.format
            : "csv";
        await downloadReportExport(item.id, format);
      } else {
        const detail = await fetchExportJob(item.id);
        const url = detail.data.download?.url;
        if (!url) {
          throw new Error("Download link is not available for this export.");
        }
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (downloadError) {
      setError(
        downloadError instanceof ClientApiError
          ? downloadError.message
          : downloadError instanceof Error
            ? downloadError.message
            : "Unable to download file.",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleExportHistory() {
    setBusy(true);
    setError(null);
    try {
      const from = dateInputToStartIso(createdFrom);
      const to = dateInputToEndIso(createdTo);
      const response = await exportExportsHistoryReport({
        ...(searchQ.trim() ? { q: searchQ.trim() } : {}),
        ...(sourceType ? { sourceType } : {}),
        ...(status ? { status } : {}),
        ...(from ? { createdFrom: from } : {}),
        ...(to ? { createdTo: to } : {}),
        columns,
        emailDownloadLink: true,
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      if (completed.status === "completed") {
        await downloadReportExport(completed.id, "csv");
      }
      void loadHistory();
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export history.",
      );
    } finally {
      setBusy(false);
    }
  }

  const show = (key: ExportsHistoryColumnKey) => columns.includes(key);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={generalSettingsPageTitleClassName}>Exports</h1>
        <p className={generalSettingsPageDescClassName}>
          Export History for report downloads and data-rights packages. Re-download files, filter
          by date, and export this history as CSV (email link when configured).
        </p>
      </div>

      {error ? <div className={analyticsAlertErrorClassName}>{error}</div> : null}

      <section className={generalSettingsFormCardClassName}>
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">Total</p>
            <p className="text-xl font-semibold">{summary?.totalCount ?? 0}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">Succeeded</p>
            <p className="text-xl font-semibold">{summary?.succeededCount ?? 0}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">Pending</p>
            <p className="text-xl font-semibold">{summary?.pendingCount ?? 0}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">Failed</p>
            <p className="text-xl font-semibold">{summary?.failedCount ?? 0}</p>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            Search
            <input
              className={fieldClassName}
              value={searchQ}
              onChange={(event) => setSearchQ(event.target.value)}
              placeholder="Report name, key, or requester"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Source
            <select
              className={fieldClassName}
              value={sourceType}
              onChange={(event) => {
                setSourceType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              <option value="report_run">Report run</option>
              <option value="export_job">Data rights</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Status
            <select
              className={fieldClassName}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              <option value="SUCCEEDED">Succeeded</option>
              <option value="QUEUED">Queued</option>
              <option value="RUNNING">Running</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            From
            <input
              type="date"
              className={fieldClassName}
              value={createdFrom}
              onChange={(event) => {
                setCreatedFrom(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="grid gap-1 text-sm">
            To
            <input
              type="date"
              className={fieldClassName}
              value={createdTo}
              onChange={(event) => {
                setCreatedTo(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => {
              setPage(1);
              void loadHistory();
            }}
          >
            Apply
          </button>
          <button
            type="button"
            className={analyticsExportButtonClassName}
            disabled={busy || loading}
            onClick={() => void handleExportHistory()}
          >
            {busy ? "Exporting…" : "Export history CSV"}
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {EXPORTS_HISTORY_COLUMN_OPTIONS.map((option) => (
            <label key={option.key} className="flex items-center gap-1 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={columns.includes(option.key)}
                onChange={() => toggleColumn(option.key)}
              />
              {option.label}
            </label>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-neutral-600">Loading export history…</p>
        ) : (
          <div className={analyticsTableShellClassName}>
            <table className="min-w-full text-left text-sm">
              <thead className={analyticsTableHeadClassName}>
                <tr>
                  {show("source_type") ? <th className="px-3 py-2">Source</th> : null}
                  {show("definition_title") ? <th className="px-3 py-2">Report</th> : null}
                  {show("definition_key") ? <th className="px-3 py-2">Key</th> : null}
                  {show("status") ? <th className="px-3 py-2">Status</th> : null}
                  {show("format") ? <th className="px-3 py-2">Format</th> : null}
                  {show("row_count") ? <th className="px-3 py-2">Rows</th> : null}
                  {show("requested_by_name") ? <th className="px-3 py-2">Requested by</th> : null}
                  {show("created_at") ? <th className="px-3 py-2">Created</th> : null}
                  {show("completed_at") ? <th className="px-3 py-2">Completed</th> : null}
                  {show("expires_at") ? <th className="px-3 py-2">Expires</th> : null}
                  {show("has_file") ? <th className="px-3 py-2">Has file</th> : null}
                  <th className="px-3 py-2">File</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-neutral-500" colSpan={12}>
                      No exports yet. Run Export on any report to create history entries.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={`${item.sourceType}-${item.id}`} className={analyticsTableRowClassName}>
                      {show("source_type") ? (
                        <td className="px-3 py-2">{titleCase(item.sourceType)}</td>
                      ) : null}
                      {show("definition_title") ? (
                        <td className="px-3 py-2">{item.definitionTitle ?? "—"}</td>
                      ) : null}
                      {show("definition_key") ? (
                        <td className="px-3 py-2 font-mono text-xs">
                          {item.definitionKey ?? "—"}
                        </td>
                      ) : null}
                      {show("status") ? (
                        <td className="px-3 py-2">{titleCase(item.status.toLowerCase())}</td>
                      ) : null}
                      {show("format") ? (
                        <td className="px-3 py-2">{item.format?.toUpperCase() ?? "—"}</td>
                      ) : null}
                      {show("row_count") ? (
                        <td className="px-3 py-2">
                          {item.rowCount == null ? "—" : item.rowCount.toLocaleString()}
                        </td>
                      ) : null}
                      {show("requested_by_name") ? (
                        <td className="px-3 py-2">{item.requestedByName ?? "—"}</td>
                      ) : null}
                      {show("created_at") ? (
                        <td className="px-3 py-2">{formatDate(item.createdAt)}</td>
                      ) : null}
                      {show("completed_at") ? (
                        <td className="px-3 py-2">{formatDate(item.completedAt)}</td>
                      ) : null}
                      {show("expires_at") ? (
                        <td className="px-3 py-2">{formatDate(item.expiresAt)}</td>
                      ) : null}
                      {show("has_file") ? (
                        <td className="px-3 py-2">{item.hasFile ? "Yes" : "No"}</td>
                      ) : null}
                      <td className="px-3 py-2">
                        {item.canDownload ? (
                          <button
                            type="button"
                            className={ghostButtonClassName}
                            disabled={downloadingId === item.id}
                            onClick={() => void handleDownload(item)}
                          >
                            {downloadingId === item.id ? "Opening…" : "Download"}
                          </button>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className={ghostButtonClassName}
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span className="text-sm text-neutral-600">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className={ghostButtonClassName}
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>

      <CustomReportBuilder onRunStarted={() => void loadHistory()} />
      <BiExportPanel />
    </div>
  );
}
