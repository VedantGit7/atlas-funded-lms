"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Check,
  ChevronRight,
  CloudOff,
  Copy,
  Download,
  Link2,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import { downloadReportExport } from "./admin-reports-api";
import {
  cancelExportRun,
  deleteExportRunFile,
  fetchExportRunDetail,
  retryExportRun,
  type ExportRunDetail,
  type ExportRunPipelineStage,
} from "./admin-export-run-detail-api";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const dangerOutlineButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-danger)] bg-transparent px-3 text-[13px] font-semibold text-[var(--admin-danger)] transition-all hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50";

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatAbsolute(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatClock(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatRelative(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const delta = Date.now() - date.getTime();
  const seconds = Math.round(delta / 1000);
  if (seconds < 60) return `${String(seconds)}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${String(hours)}h ago`;
  const days = Math.round(hours / 24);
  return `${String(days)}d ago`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "-";
  if (seconds < 60) return `${String(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem === 0 ? `${String(mins)}m` : `${String(mins)}m ${String(rem)}s`;
}

function expiresInLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days === 1) return "in 1 day";
  return `in ${String(days)} days`;
}

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return false;
  const ms = date.getTime() - Date.now();
  return ms > 0 && ms <= 48 * 60 * 60 * 1000;
}

function statusLabel(status: string): string {
  switch (status) {
    case "SUCCEEDED":
      return "Succeeded";
    case "FAILED":
      return "Failed";
    case "RUNNING":
      return "Running";
    case "QUEUED":
      return "Queued";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function statusPillClass(status: string): string {
  if (status === "SUCCEEDED") {
    return "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (status === "FAILED") {
    return "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  if (status === "RUNNING" || status === "QUEUED") {
    return "border-[var(--admin-primary-strong)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary-strong)]";
  }
  return "border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
}

function Shimmer({ className }: { className: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded bg-[var(--admin-surface-high)] ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--admin-surface)_65%,transparent)] to-transparent motion-reduce:animate-none" />
    </div>
  );
}

function DetailLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading export run">
      <div className="flex flex-col gap-3">
        <Shimmer className="h-4 w-64" />
        <Shimmer className="h-8 w-80" />
        <div className="flex gap-2">
          <Shimmer className="h-6 w-20" />
          <Shimmer className="h-6 w-24" />
          <Shimmer className="h-6 w-16" />
        </div>
      </div>
      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
        <div className="mb-6 flex gap-4">
          <Shimmer className="h-7 w-24" />
          <Shimmer className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Shimmer className="h-3 w-16" />
              <Shimmer className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
        <Shimmer className="mb-6 h-5 w-40" />
        <div className="flex items-center gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <Shimmer className="h-6 w-6 rounded-full" />
              <Shimmer className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <Shimmer className="mb-4 h-5 w-36" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="mb-4 flex justify-between gap-4 border-b border-[var(--admin-border)] pb-3 last:mb-0 last:border-0"
            >
              <Shimmer className="h-4 w-20" />
              <Shimmer className="h-4 w-40" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <Shimmer className="mb-4 h-5 w-28" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="mb-3 flex gap-4">
              <Shimmer className="h-4 w-1/4" />
              <Shimmer className="h-4 w-1/5" />
              <Shimmer className="h-4 w-1/4" />
              <Shimmer className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PipelinePanel({ stages }: { stages: ExportRunPipelineStage[] }) {
  return (
    <section className="overflow-x-auto rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm">
      <h2 className="mb-6 text-[16px] font-semibold text-[var(--admin-on-surface)]">
        Pipeline execution
      </h2>
      <div className="flex min-w-max flex-col gap-6 md:flex-row md:items-start md:gap-0">
        {stages.map((stage, index) => {
          const complete = stage.state === "complete";
          const current = stage.state === "current";
          const failed = stage.state === "failed";
          const lineComplete =
            index < stages.length - 1 &&
            (stages[index + 1]?.state === "complete" ||
              stages[index + 1]?.state === "current" ||
              stages[index + 1]?.state === "failed") &&
            complete;

          return (
            <div key={stage.key} className="flex items-center md:flex-1">
              <div className="flex w-24 flex-col items-center gap-2">
                <div
                  className={`relative flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    complete
                      ? "border-[var(--admin-success)] bg-[var(--admin-success)] text-[var(--admin-on-danger)]"
                      : failed
                        ? "border-[var(--admin-danger)] bg-[var(--admin-danger)] text-[var(--admin-on-danger)]"
                        : current
                          ? "border-[var(--admin-primary-strong)] bg-[var(--admin-surface)] text-[var(--admin-primary-strong)] motion-safe:animate-[admin-pipeline-pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
                          : "border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"
                  }`}
                >
                  {complete ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : failed ? (
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : current ? (
                    <span className="h-2 w-2 rounded-full bg-[var(--admin-primary-strong)]" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-outline)]" />
                  )}
                </div>
                <span
                  className={`text-center text-[12px] font-medium ${
                    failed
                      ? "text-[var(--admin-danger)]"
                      : current
                        ? "font-semibold text-[var(--admin-primary-strong)]"
                        : complete
                          ? "text-[var(--admin-on-surface)]"
                          : "text-[var(--admin-on-surface-variant)]"
                  }`}
                >
                  {stage.label}
                </span>
                {stage.at ? (
                  <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                    {formatClock(stage.at)}
                  </span>
                ) : null}
              </div>
              {index < stages.length - 1 ? (
                <div
                  className={`mx-1 hidden h-0.5 flex-1 md:block ${
                    lineComplete || complete
                      ? failed
                        ? "bg-[var(--admin-danger)]"
                        : "bg-[var(--admin-success)]"
                      : current
                        ? "bg-[var(--admin-primary-strong)]"
                        : "bg-[var(--admin-surface-high)]"
                  }`}
                  aria-hidden="true"
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DeleteFileModal({
  open,
  detail,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  detail: ExportRunDetail;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-[var(--admin-scrim)] p-4 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close delete dialog overlay"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="admin-theme relative z-10 w-full max-w-[480px] overflow-hidden rounded-xl border border-[var(--admin-outline)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="px-6 pt-6 pb-2 text-center">
          <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_16%,transparent)] text-[var(--admin-danger)]">
            <Trash2 className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3
            id={titleId}
            className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]"
          >
            Delete file?
          </h3>
        </div>
        <div className="px-6 py-4">
          <div className="mb-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-outline)_30%,transparent)] bg-[var(--admin-surface-low)] p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  File name
                </span>
                <span className="break-all text-right font-mono text-sm text-[var(--admin-on-surface)]">
                  {detail.fileName}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-xs font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  Size
                </span>
                <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                  {detail.estimatedSizeLabel ?? "-"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-xs font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  Report
                </span>
                <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                  {detail.definitionTitle ?? "-"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-xs font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  Expiry
                </span>
                <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                  {formatAbsolute(detail.expiresAt)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg bg-[color-mix(in_srgb,var(--admin-surface-variant)_40%,transparent)] p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]" />
            <p className="text-sm leading-normal text-[var(--admin-on-surface-variant)]">
              The run record and its parameters are kept for audit while the file itself is removed
              permanently.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 px-6 py-6 sm:flex-row-reverse">
          <button
            type="button"
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--admin-danger)] text-base font-bold text-[var(--admin-on-danger)] transition-colors hover:opacity-90 disabled:opacity-50"
            disabled={busy}
            onClick={onConfirm}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {busy ? "Deleting…" : "Delete file"}
          </button>
          <button
            type="button"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-lg bg-[var(--admin-surface-high)] text-base font-bold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-variant)] disabled:opacity-50"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminExportRunDetailPage() {
  const params = useParams<{ runId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const runId = params.runId;
  const sourceTypeParam = searchParams.get("source");
  const sourceType =
    sourceTypeParam === "report_run" || sourceTypeParam === "export_job"
      ? sourceTypeParam
      : undefined;

  const [detail, setDetail] = useState<ExportRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyFlash, setCopyFlash] = useState<"id" | "name" | "params" | null>(null);
  const [showAllParams, setShowAllParams] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!runId) return;
    setError(null);
    try {
      const response = await fetchExportRunDetail(runId, sourceType);
      setDetail(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load export run.",
      );
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [runId, sourceType]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!detail) return;
    if (detail.status !== "QUEUED" && detail.status !== "RUNNING") return;
    const timer = window.setInterval(() => {
      void load();
    }, 2500);
    return () => {
      window.clearInterval(timer);
    };
  }, [detail?.status, load]);

  const rawJson = useMemo(() => {
    if (!detail) return "";
    return JSON.stringify(detail.params, null, 2);
  }, [detail]);

  const rawPreview = useMemo(() => {
    if (!rawJson) return "";
    if (showAllParams) return rawJson;
    const lines = rawJson.split("\n");
    if (lines.length <= 6) return rawJson;
    return `${lines.slice(0, 6).join("\n")}\n…`;
  }, [rawJson, showAllParams]);

  async function copyText(value: string, kind: "id" | "name" | "params") {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFlash(kind);
      window.setTimeout(() => {
        setCopyFlash(null);
      }, 1600);
    } catch {
      setError("Unable to copy to clipboard.");
    }
  }

  async function handleDownload() {
    if (!detail?.canDownload) return;
    setDownloading(true);
    setError(null);
    try {
      if (detail.sourceType === "report_run") {
        const format =
          detail.format === "xlsx" || detail.format === "pdf" || detail.format === "csv"
            ? detail.format
            : "csv";
        await downloadReportExport(detail.id, format);
      } else if (detail.download?.url) {
        window.open(detail.download.url, "_blank", "noopener,noreferrer");
      } else {
        throw new Error("Download link is not available.");
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
      setDownloading(false);
    }
  }

  async function handleRetry() {
    if (!detail?.canRetry) return;
    setActionBusy(true);
    setError(null);
    try {
      const response = await retryExportRun(detail.id, detail.sourceType);
      router.push(`/admin/reports/exports/${response.data.id}?source=${response.data.sourceType}`);
    } catch (retryError) {
      setError(
        retryError instanceof ClientApiError
          ? retryError.message
          : retryError instanceof Error
            ? retryError.message
            : "Unable to re-run export.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCancel() {
    if (!detail?.canCancel) return;
    setActionBusy(true);
    setError(null);
    try {
      await cancelExportRun(detail.id, detail.sourceType);
      await load();
    } catch (cancelError) {
      setError(
        cancelError instanceof ClientApiError
          ? cancelError.message
          : cancelError instanceof Error
            ? cancelError.message
            : "Unable to cancel export.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDeleteFile() {
    if (!detail?.canDeleteFile) return;
    setActionBusy(true);
    setError(null);
    try {
      await deleteExportRunFile(detail.id, detail.sourceType);
      setDeleteOpen(false);
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof ClientApiError
          ? deleteError.message
          : deleteError instanceof Error
            ? deleteError.message
            : "Unable to delete file.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <DetailLoadingSkeleton />;
  }

  if (error && !detail) {
    return (
      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
        <XCircle className="mx-auto mb-3 h-10 w-10 text-[var(--admin-danger)]" aria-hidden="true" />
        <h2 className="mb-2 text-lg font-semibold text-[var(--admin-on-surface)]">
          Unable to load export
        </h2>
        <p className="mb-4 text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
        <div className="flex justify-center gap-3">
          <Link href="/admin/reports/exports" className={secondaryButtonClassName}>
            All exports
          </Link>
          <button type="button" className={primaryButtonClassName} onClick={() => void load()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const title =
    detail.hasFile || detail.status === "SUCCEEDED"
      ? detail.fileName
      : (detail.definitionTitle ?? detail.fileName);
  const expiringSoon = isExpiringSoon(detail.expiresAt);
  const expiresLabel = expiresInLabel(detail.expiresAt);
  const running = detail.status === "RUNNING" || detail.status === "QUEUED";
  const failed = detail.status === "FAILED";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--admin-on-surface-variant)]">
        <Link href="/admin" className="hover:text-[var(--admin-on-surface)]">
          Admin
        </Link>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <Link href="/admin/reports/exports" className="hover:text-[var(--admin-on-surface)]">
          Reports
        </Link>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <Link href="/admin/reports/exports" className="hover:text-[var(--admin-on-surface)]">
          Exports
        </Link>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <span className="font-mono font-medium text-[var(--admin-on-surface)]">{title}</span>
      </div>

      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <h1 className="font-mono text-[20px] font-semibold text-[var(--admin-on-surface)]">
              {title}
            </h1>
            <button
              type="button"
              className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
              aria-label="Copy file name"
              onClick={() => void copyText(title, "name")}
            >
              {copyFlash === "name" ? (
                <Check className="h-5 w-5 text-[var(--admin-success)]" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[12px] text-[var(--admin-on-surface)]">
              {detail.sourceType === "report_run" ? "Report run" : "Export job"}
            </span>
            {detail.definitionTitle && detail.definitionKey ? (
              <Link
                href={`/admin/reports/${detail.definitionKey}`}
                className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[12px] text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)]"
              >
                {detail.definitionTitle}
              </Link>
            ) : detail.definitionTitle ? (
              <span className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[12px] text-[var(--admin-on-surface)]">
                {detail.definitionTitle}
              </span>
            ) : null}
            {detail.definitionKey ? (
              <span className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 font-mono text-[12px] text-[var(--admin-on-surface)]">
                {detail.definitionKey}
              </span>
            ) : null}
            {detail.format ? (
              <span className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[12px] uppercase text-[var(--admin-on-surface)]">
                {detail.format}
              </span>
            ) : null}
            {detail.containsPersonalData ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] px-2 py-1 text-[12px] text-[var(--admin-warning)]">
                Contains personal data
              </span>
            ) : null}
          </div>
          {!detail.hasFile && detail.status !== "SUCCEEDED" ? (
            <p className="mt-2 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
              {detail.id}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => void copyText(detail.id, "id")}
          >
            <Link2 className="h-[18px] w-[18px]" aria-hidden="true" />
            {copyFlash === "id" ? "Copied" : "Copy run ID"}
          </button>
          {detail.canRetry && !running ? (
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={actionBusy}
              onClick={() => void handleRetry()}
            >
              <RefreshCw className="h-[18px] w-[18px]" aria-hidden="true" />
              Re-run
            </button>
          ) : null}
          {detail.canDeleteFile ? (
            <button
              type="button"
              className={dangerOutlineButtonClassName}
              disabled={actionBusy}
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
              Delete file
            </button>
          ) : null}
          {running ? (
            <button
              type="button"
              className={dangerOutlineButtonClassName}
              disabled={actionBusy || !detail.canCancel}
              onClick={() => void handleCancel()}
            >
              <XCircle className="h-[18px] w-[18px]" aria-hidden="true" />
              Cancel run
            </button>
          ) : failed ? (
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={actionBusy || !detail.canRetry}
              onClick={() => void handleRetry()}
            >
              Retry
            </button>
          ) : detail.canDownload ? (
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={downloading}
              onClick={() => void handleDownload()}
            >
              <Download className="h-[18px] w-[18px]" aria-hidden="true" />
              {downloading
                ? "Downloading…"
                : `Download${detail.estimatedSizeLabel ? ` (${detail.estimatedSizeLabel})` : ""}`}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] px-4 py-3 text-sm text-[var(--admin-danger)]">
          {error}
        </div>
      ) : null}

      {failed ? (
        <section className="flex flex-col gap-4 rounded-r-xl border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] border-l-4 border-l-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" />
            <div>
              <h2 className="font-mono text-[16px] font-semibold text-[var(--admin-danger)]">
                {detail.errorCode ?? "ExportFailed"}
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface)]">
                {detail.errorMessage ?? "The export failed before a file was produced."}
              </p>
              {detail.failedStage ? (
                <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                  Failed during the{" "}
                  <strong className="text-[var(--admin-on-surface)]">{detail.failedStage}</strong>{" "}
                  execution stage.
                </p>
              ) : null}
              {detail.failureHint ? (
                <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                  {detail.failureHint}
                </p>
              ) : null}
            </div>
          </div>
          <div className="ml-8 flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-lg bg-[var(--admin-danger)] px-4 text-sm font-semibold text-[var(--admin-on-danger)] transition-colors hover:opacity-90 disabled:opacity-50"
              disabled={actionBusy || !detail.canRetry}
              onClick={() => void handleRetry()}
            >
              Retry now
            </button>
            {detail.definitionKey ? (
              <Link
                href={`/admin/reports/${detail.definitionKey}`}
                className="inline-flex h-8 items-center rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] px-4 text-sm text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)]"
              >
                Retry with a narrower range
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-6 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm">
        {running ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
            <div className="flex w-full flex-col justify-center border-b border-[var(--admin-border)] pb-4 md:w-1/3 md:border-r md:border-b-0 md:pb-0 md:pr-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[16px] font-semibold text-[var(--admin-on-surface)]">
                  {statusLabel(detail.status)}
                </span>
                <span className="font-mono text-[13px] font-semibold text-[var(--admin-primary-strong)]">
                  {detail.progressPercent == null ? "-" : `${String(detail.progressPercent)}%`}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                <div
                  className="h-full rounded-full bg-[var(--admin-primary-strong)] transition-all duration-500 ease-out"
                  style={{ width: `${String(detail.progressPercent ?? 8)}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                {detail.rowCount != null ? `${formatCount(detail.rowCount)} rows · ` : ""}
                started {formatRelative(detail.startedAt ?? detail.createdAt)}
              </p>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4 md:pl-4">
              <div>
                <div className="text-[12px] text-[var(--admin-on-surface-variant)]">
                  Initiated by
                </div>
                <div className="mt-1 text-sm text-[var(--admin-on-surface)]">
                  {detail.requestedByName ?? detail.requestedByEmail ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-[var(--admin-on-surface-variant)]">
                  Destination
                </div>
                <div className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {detail.delivery.label}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-[var(--admin-on-surface-variant)]">Format</div>
                <div className="mt-1 text-sm uppercase text-[var(--admin-on-surface)]">
                  {detail.format ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-[var(--admin-on-surface-variant)]">Updated</div>
                <div className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {formatRelative(detail.updatedAt)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <span
                className={`inline-flex items-center rounded px-2 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase ${statusPillClass(detail.status)}`}
              >
                {statusLabel(detail.status)}
              </span>
              <div className="font-mono text-[28px] font-light tracking-tight text-[var(--admin-on-surface)]">
                {failed
                  ? `Failed ${formatClock(detail.completedAt)}`
                  : `Completed in ${formatDuration(detail.durationSeconds)}`}
              </div>
            </div>
            <div className="border-b border-[var(--admin-border)] pb-6 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
              Queued {formatClock(detail.createdAt)}
              {detail.startedAt ? ` · Started ${formatClock(detail.startedAt)}` : ""}
              {detail.completedAt ? ` · Completed ${formatClock(detail.completedAt)}` : ""}
            </div>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <div>
                <div className="mb-1 text-[12px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  Rows
                </div>
                <div className="font-mono text-sm font-medium text-[var(--admin-on-surface)]">
                  {detail.rowCount == null ? "-" : formatCount(detail.rowCount)}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[12px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  File size
                </div>
                <div className="font-mono text-sm font-medium text-[var(--admin-on-surface)]">
                  {detail.estimatedSizeLabel ?? (detail.hasFile ? "Available" : "No file")}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[12px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  Format
                </div>
                <div className="text-sm font-medium uppercase text-[var(--admin-on-surface)]">
                  {detail.format ?? "-"}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[12px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  Expires
                </div>
                <div
                  className={`flex flex-wrap items-center gap-2 text-sm font-medium ${
                    expiringSoon ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface)]"
                  }`}
                >
                  {expiresLabel ?? "-"}
                  {detail.expiresAt ? (
                    <span className="font-mono text-[12px] font-normal text-[var(--admin-on-surface-variant)]">
                      ({detail.expiresAt.slice(0, 10)})
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <PipelinePanel stages={detail.pipeline} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <div className="border-b border-[var(--admin-border)] p-6">
            <h2 className="text-[16px] font-semibold text-[var(--admin-on-surface)]">
              Run parameters
            </h2>
          </div>
          <div className="flex flex-grow flex-col gap-5 p-6">
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 border-b border-[var(--admin-border)] pb-4">
              <div className="text-[12px] text-[var(--admin-on-surface-variant)]">Definition</div>
              <div>
                <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                  {detail.definitionTitle ?? "-"}
                </span>
                {detail.definitionKey ? (
                  <span className="ml-2 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                    ({detail.definitionKey})
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 border-b border-[var(--admin-border)] pb-4">
              <div className="text-[12px] text-[var(--admin-on-surface-variant)]">Filters</div>
              <div className="flex flex-wrap gap-2">
                {detail.filterChips.length === 0 ? (
                  <span className="text-sm italic text-[var(--admin-on-surface-variant)]">
                    None
                  </span>
                ) : (
                  detail.filterChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 font-mono text-[12px] text-[var(--admin-on-surface)]"
                    >
                      {chip}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 border-b border-[var(--admin-border)] pb-4">
              <div className="text-[12px] text-[var(--admin-on-surface-variant)]">Columns</div>
              <div className="flex flex-wrap gap-2">
                {detail.columnChips.length === 0 ? (
                  <span className="text-sm italic text-[var(--admin-on-surface-variant)]">
                    Default set
                  </span>
                ) : (
                  <>
                    {detail.columnChips.map((column) => (
                      <span
                        key={column}
                        className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 font-mono text-[12px] text-[var(--admin-on-surface)]"
                      >
                        {column}
                      </span>
                    ))}
                    {detail.columnsTotal > detail.columnChips.length ? (
                      <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 font-mono text-[12px] italic text-[var(--admin-on-surface-variant)]">
                        + {detail.columnsTotal - detail.columnChips.length} more
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 border-b border-[var(--admin-border)] pb-4">
              <div className="text-[12px] text-[var(--admin-on-surface-variant)]">Sort</div>
              <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                {detail.sortLabel ?? "Default"}
              </div>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 border-b border-[var(--admin-border)] pb-4">
              <div className="text-[12px] text-[var(--admin-on-surface-variant)]">Row limit</div>
              <div className="font-mono text-[13px] text-[var(--admin-on-surface-variant)] italic">
                {detail.rowLimitLabel ?? "None"}
              </div>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4">
              <div className="text-[12px] text-[var(--admin-on-surface-variant)]">Delivery</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[12px] text-[var(--admin-on-surface)]">
                  {detail.delivery.label}
                </span>
                {detail.delivery.recipients.map((recipient) => (
                  <span
                    key={recipient}
                    className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 font-mono text-[12px] text-[var(--admin-on-surface)]"
                  >
                    {recipient}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-medium text-[var(--admin-on-surface-variant)]">
                  Raw parameters
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="text-[12px] text-[var(--admin-primary-strong)] hover:underline"
                    onClick={() => void copyText(rawJson, "params")}
                  >
                    {copyFlash === "params" ? "Copied" : "Copy"}
                  </button>
                  {rawJson.split("\n").length > 6 ? (
                    <button
                      type="button"
                      className="text-[12px] text-[var(--admin-primary-strong)] hover:underline"
                      onClick={() => {
                        setShowAllParams((current) => !current);
                      }}
                    >
                      {showAllParams ? "Show less" : "Show all"}
                    </button>
                  ) : null}
                </div>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 font-mono text-[12px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                {rawPreview}
              </pre>
            </div>
          </div>
        </section>

        <section className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--admin-border)] p-6">
            <h2 className="text-[16px] font-semibold text-[var(--admin-on-surface)]">Access log</h2>
          </div>
          {detail.accessLog.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <CloudOff className="mb-3 h-10 w-10 text-[var(--admin-outline)]" aria-hidden="true" />
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                No one has downloaded this file yet.
              </p>
              <p className="mt-1 text-[12px] text-[var(--admin-on-surface-variant)]">
                {detail.accessLogAvailable
                  ? "Downloads will appear here."
                  : failed
                    ? "The export failed before generation."
                    : "Download access logging is not enabled for this tenant yet."}
              </p>
            </div>
          ) : (
            <div className="w-full flex-grow overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                    <th className="px-6 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Admin
                    </th>
                    <th className="px-6 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Action
                    </th>
                    <th className="px-6 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      IP address
                    </th>
                    <th className="px-6 py-3 text-right text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.accessLog.map((entry) => (
                    <tr
                      key={entry.id}
                      className="h-11 border-b border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-low)] last:border-b-0"
                    >
                      <td className="px-6 py-2 text-sm font-medium text-[var(--admin-on-surface)]">
                        {entry.actorName}
                      </td>
                      <td className="px-6 py-2">
                        <span className="rounded bg-[var(--admin-surface-low)] px-2 py-1 font-mono text-[11px] text-[var(--admin-on-surface)]">
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-6 py-2 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                        {entry.ipAddress ?? "-"}
                      </td>
                      <td className="px-6 py-2 text-right font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                        {formatRelative(entry.at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
        <Link
          href="/admin/reports/exports"
          className="text-[var(--admin-primary-strong)] hover:underline"
        >
          All exports
        </Link>
        {" · "}
        Run records are kept for audit even after their files are removed.
      </p>

      <DeleteFileModal
        open={deleteOpen}
        detail={detail}
        busy={actionBusy}
        onClose={() => {
          setDeleteOpen(false);
        }}
        onConfirm={() => void handleDeleteFile()}
      />
    </div>
  );
}
