"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Info,
  Pause,
  Play,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import { downloadReportExport } from "./admin-reports-api";
import {
  deleteReportSchedule,
  duplicateSchedule,
  fetchScheduleDetail,
  runScheduleNow,
  updateReportSchedule,
  type ScheduleDetail,
  type ScheduleDetailRun,
} from "./admin-export-schedules-api";

const primaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 text-[13px] font-semibold text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const dangerOutlineButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-danger)] bg-transparent px-3 text-[13px] font-semibold text-[var(--admin-danger)] transition-all hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] active:translate-y-px disabled:opacity-50";

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatAbsolute(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function formatRelative(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) {
    const ahead = Math.abs(diffMs);
    if (ahead < 60_000) return "in under a minute";
    const mins = Math.floor(ahead / 60_000);
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 48) return `in ${hours}h`;
    return `in ${Math.floor(hours / 24)}d`;
  }
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDurationMs(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem === 0 ? `${mins}m` : `${mins}m ${rem}s`;
}

function statusPill(status: string) {
  const tone =
    status === "SUCCEEDED"
      ? "border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]"
      : status === "FAILED"
        ? "border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]"
        : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
  const label = status === "SUCCEEDED" ? "Succeeded" : status === "FAILED" ? "Failed" : status;
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}

function deliveryPill(run: ScheduleDetailRun) {
  if (!run.deliveryLabel) return <span className="text-[var(--admin-on-surface-variant)]">-</span>;
  const failed = run.deliveryStatus === "failed";
  const tone = failed
    ? "border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]"
    : "border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${tone}`}
    >
      {failed ? "Delivery failed" : run.deliveryLabel}
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <div className="h-10 w-full rounded bg-[var(--admin-surface-low)]" />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - ((v - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      className="h-10 w-full text-[var(--admin-primary)]"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--admin-surface-low)] ${className ?? "h-4 w-24"}`}
    />
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading schedule">
      <SkeletonBar className="h-4 w-64" />
      <div className="flex justify-between gap-4">
        <div className="space-y-3">
          <SkeletonBar className="h-8 w-72" />
          <SkeletonBar className="h-4 w-48" />
          <div className="flex gap-2">
            <SkeletonBar className="h-6 w-20" />
            <SkeletonBar className="h-6 w-24" />
            <SkeletonBar className="h-6 w-16" />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonBar className="h-9 w-24" />
          <SkeletonBar className="h-9 w-20" />
          <SkeletonBar className="h-9 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-lg border border-[var(--admin-border)] lg:grid-cols-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-r border-[var(--admin-border)] p-5 last:border-r-0">
            <SkeletonBar className="mb-3 h-3 w-20" />
            <SkeletonBar className="mb-2 h-8 w-16" />
            <SkeletonBar className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SkeletonBar className="h-40 w-full" />
          <SkeletonBar className="h-64 w-full" />
        </div>
        <SkeletonBar className="h-96 w-full" />
      </div>
    </div>
  );
}

function DeleteModal({
  name,
  cadence,
  destination,
  pastRuns,
  busy,
  onCancel,
  onConfirm,
}: {
  name: string;
  cadence: string;
  destination: string;
  pastRuns: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-schedule-detail-title"
    >
      <div className="admin-theme flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-6 py-5">
          <div className="flex items-start gap-3 text-[var(--admin-danger)]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <h2
              id="delete-schedule-detail-title"
              className="text-base font-semibold text-[var(--admin-on-surface)]"
            >
              Delete schedule: {name}?
            </h2>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-low)]"
            onClick={onCancel}
            aria-label="Close"
            disabled={busy}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-3 gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <div>
              <p className="mb-1 text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                Cadence
              </p>
              <p className="text-sm font-medium text-[var(--admin-on-surface)]">{cadence}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                Destination
              </p>
              <p className="text-sm font-medium text-[var(--admin-on-surface)]">{destination}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                Past runs
              </p>
              <p className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                {formatCount(pastRuns)} runs
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-[var(--admin-border)] p-3 text-sm text-[var(--admin-on-surface-variant)]">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Past runs and their files are kept for audit while the schedule is removed
              permanently.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] px-6 py-4">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--admin-danger)] px-4 text-[13px] font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
            onClick={onConfirm}
            disabled={busy}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {busy ? "Deleting…" : "Delete schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminExportScheduleDetailPage() {
  const params = useParams<{ scheduleId: string }>();
  const router = useRouter();
  const scheduleId = params.scheduleId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScheduleDetail | null>(null);
  const [runsPage, setRunsPage] = useState(1);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!scheduleId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchScheduleDetail(scheduleId, {
        runsPage,
        runsLimit: 10,
      });
      setDetail(response.data);
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to load schedule.",
      );
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [scheduleId, runsPage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggle() {
    if (!detail) return;
    const next = !detail.isActive;
    if (!next) {
      const ok = window.confirm(`Pause schedule "${detail.name}"?`);
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateReportSchedule(detail.id, { isActive: next });
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to update schedule.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRunNow() {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await runScheduleNow(detail.id);
      setRunsPage(1);
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to run schedule.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const created = await duplicateSchedule(detail.id);
      router.push(`/admin/reports/exports/schedules/${created.data.id}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to duplicate schedule.");
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await deleteReportSchedule(detail.id);
      router.push("/admin/reports/exports/schedules");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to delete schedule.");
      setBusy(false);
    }
  }

  async function handleDownload(run: ScheduleDetailRun) {
    if (!run.canDownload || !run.format) return;
    setDownloadingId(run.id);
    try {
      await downloadReportExport(run.id, run.format);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Download failed.");
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading && !detail) return <DetailSkeleton />;

  if (error && !detail) {
    return (
      <div
        className="flex flex-wrap items-center gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4"
        role="alert"
      >
        <AlertCircle className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-[var(--admin-danger)]">Couldn&apos;t load schedule.</h2>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
        </div>
        <button type="button" className={secondaryButtonClassName} onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (!detail) return null;

  const destinationLabel = detail.destinations.map((d) => d.label).join(", ") || "Download";
  const neverRun = detail.stats.totalRuns === 0;

  return (
    <div className="relative flex flex-col gap-8 pb-16">
      <div>
        <Link
          href="/admin/reports/exports/schedules"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All schedules
        </Link>
        <nav
          className="mb-3 flex flex-wrap items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]"
          aria-label="Breadcrumb"
        >
          <span>Admin</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Reports</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/admin/reports/exports" className="hover:text-[var(--admin-primary)]">
            Exports
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link
            href="/admin/reports/exports/schedules"
            className="hover:text-[var(--admin-primary)]"
          >
            Schedules
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-medium text-[var(--admin-on-surface)]">{detail.name}</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
              {detail.name}
            </h1>
            <p className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
              {detail.definitionTitle} ({detail.definitionKey})
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                  detail.isActive
                    ? "border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]"
                    : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    detail.isActive
                      ? "bg-[var(--admin-success)]"
                      : "bg-[var(--admin-on-surface-variant)]"
                  }`}
                />
                {detail.isActive ? "Enabled" : "Paused"}
              </span>
              <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {detail.cadenceLabel}
              </span>
              <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-mono text-[11px] uppercase text-[var(--admin-on-surface-variant)]">
                {detail.primaryFormat}
              </span>
              <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {destinationLabel}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2 flex items-center gap-2 border-r border-[var(--admin-border)] pr-4">
              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                Schedule active
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={detail.isActive}
                disabled={busy}
                onClick={() => void handleToggle()}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  detail.isActive
                    ? "bg-[var(--admin-primary)]"
                    : "border border-[var(--admin-outline)] bg-[var(--admin-surface-variant)]"
                }`}
              >
                <span
                  className={`absolute h-4 w-4 rounded-full bg-[var(--admin-surface)] shadow transition-all ${
                    detail.isActive ? "right-0.5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => void handleRunNow()}
              disabled={busy}
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Run now
            </button>
            <Link href={detail.config.editBuilderHref} className={secondaryButtonClassName}>
              Edit
            </Link>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => void handleDuplicate()}
              disabled={busy}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Duplicate
            </button>
            <button
              type="button"
              className={dangerOutlineButtonClassName}
              onClick={() => {
                setDeleteOpen(true);
              }}
              disabled={busy}
            >
              Delete schedule
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] md:grid-cols-2 lg:grid-cols-6">
        <div className="border-b border-[var(--admin-border)] p-5 md:col-span-2 lg:border-r lg:border-b-0">
          <h3 className="mb-2 text-xs tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
            Next run
          </h3>
          <p className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-on-surface)]">
            {detail.isActive && detail.stats.nextRunAt
              ? formatRelative(detail.stats.nextRunAt)
              : detail.isActive
                ? "-"
                : "Paused"}
          </p>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            {detail.stats.nextRunAt
              ? `${formatAbsolute(detail.stats.nextRunAt)} ${detail.config.timezone}`
              : "-"}
          </p>
        </div>
        <div className="border-b border-[var(--admin-border)] p-5 lg:border-r lg:border-b-0">
          <h3 className="mb-2 text-xs tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
            Total runs
          </h3>
          <p className="text-xl font-semibold text-[var(--admin-on-surface)]">
            {formatCount(detail.stats.totalRuns)}
          </p>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            <span className="text-[var(--admin-success)]">
              {formatCount(detail.stats.succeededRuns)} succeeded
            </span>{" "}
            ·{" "}
            <span className="text-[var(--admin-danger)]">
              {formatCount(detail.stats.failedRuns)} failed
            </span>
          </p>
        </div>
        <div className="border-b border-[var(--admin-border)] p-5 lg:border-r lg:border-b-0">
          <h3 className="mb-2 text-xs tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
            Success rate
          </h3>
          <p className="text-xl font-semibold text-[var(--admin-on-surface)]">
            {detail.stats.successRatePercent != null ? `${detail.stats.successRatePercent}%` : "-"}
          </p>
          <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-variant)]">
            <div
              className="h-full rounded-full bg-[var(--admin-success)]"
              style={{
                width: `${detail.stats.successRatePercent ?? 0}%`,
              }}
            />
          </div>
        </div>
        <div className="border-b border-[var(--admin-border)] p-5 lg:border-r lg:border-b-0">
          <h3 className="mb-2 text-xs tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
            Avg. duration
          </h3>
          <p className="text-xl font-semibold text-[var(--admin-on-surface)]">
            {formatDurationMs(detail.stats.avgDurationMs)}
          </p>
        </div>
        <div className="relative overflow-hidden p-5">
          <h3 className="mb-2 text-xs tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
            Avg. rows
          </h3>
          <p className="text-xl font-semibold text-[var(--admin-on-surface)]">
            {detail.stats.avgRowCount != null ? formatCount(detail.stats.avgRowCount) : "-"}
          </p>
          <div className="mt-2 opacity-80">
            <Sparkline values={detail.stats.rowSparkline} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {detail.trouble ? (
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_6%,var(--admin-surface))] p-4">
              <div className="flex items-start gap-3">
                <AlertCircle
                  className="mt-0.5 h-5 w-5 text-[var(--admin-danger)]"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-[var(--admin-danger)]">
                    {detail.trouble.consecutiveFailures} consecutive failures
                  </h3>
                  <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                    {detail.trouble.lastErrorMessage}
                  </p>
                  {detail.trouble.failingSinceAt ? (
                    <p className="mt-1 text-xs text-[var(--admin-danger)]">
                      Started failing {formatRelative(detail.trouble.failingSinceAt)}
                    </p>
                  ) : null}
                  {detail.trouble.retriesRemainingBeforePause != null ? (
                    <p className="mt-2 text-xs text-[color-mix(in_srgb,var(--admin-danger)_80%,transparent)]">
                      This schedule will retry {detail.trouble.retriesRemainingBeforePause} more
                      time
                      {detail.trouble.retriesRemainingBeforePause === 1 ? "" : "s"} before
                      auto-pausing.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detail.trouble.failingRunId ? (
                      <Link
                        href={`/admin/reports/exports/${detail.trouble.failingRunId}?source=report_run`}
                        className={secondaryButtonClassName}
                      >
                        Open the failing run
                      </Link>
                    ) : null}
                    {detail.isActive ? (
                      <button
                        type="button"
                        className={secondaryButtonClassName}
                        onClick={() => void handleToggle()}
                        disabled={busy}
                      >
                        <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                        Pause this schedule
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-4">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Run history
              </h2>
            </div>

            {neverRun ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center p-10 text-center">
                <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
                  <Clock className="h-12 w-12" strokeWidth={1.25} aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                  This schedule has not run yet.
                </h3>
                <p className="mb-8 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                  {detail.stats.nextRunAt
                    ? `The first run is scheduled for ${formatAbsolute(detail.stats.nextRunAt)} ${detail.config.timezone}. You can wait for the automated trigger or execute it manually now.`
                    : "Enable the schedule or run it manually to produce the first export."}
                </p>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() => void handleRunNow()}
                  disabled={busy}
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  Run now
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                        <th className="px-4 py-3 text-[12px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                          Run / file
                        </th>
                        <th className="px-4 py-3 text-[12px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right text-[12px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                          Rows
                        </th>
                        <th className="px-4 py-3 text-[12px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                          Duration
                        </th>
                        <th className="px-4 py-3 text-[12px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                          Started
                        </th>
                        <th className="px-4 py-3 text-[12px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                          Delivery
                        </th>
                        <th className="px-4 py-3 text-right text-[12px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.runs.map((run) => (
                        <tr
                          key={run.id}
                          className="border-b border-[var(--admin-border)] hover:bg-[var(--admin-surface-low)]"
                        >
                          <td className="px-4 py-3">
                            {run.fileName ? (
                              <Link
                                href={`/admin/reports/exports/${run.id}?source=report_run`}
                                className="font-mono text-[13px] text-[var(--admin-primary)] hover:underline"
                              >
                                {run.fileName}
                              </Link>
                            ) : (
                              <Link
                                href={`/admin/reports/exports/${run.id}?source=report_run`}
                                className="font-mono text-[13px] text-[var(--admin-on-surface-variant)] hover:underline"
                              >
                                {run.id.slice(0, 8)}
                              </Link>
                            )}
                          </td>
                          <td className="px-4 py-3">{statusPill(run.status)}</td>
                          <td className="px-4 py-3 text-right font-mono text-[13px]">
                            {run.rowCount != null ? formatCount(run.rowCount) : "-"}
                            {run.rowDelta != null ? (
                              <div
                                className={`text-[11px] ${
                                  run.rowDelta < 0
                                    ? "text-[var(--admin-danger)]"
                                    : "text-[var(--admin-on-surface-variant)]"
                                }`}
                              >
                                {run.rowDelta > 0 ? "+" : ""}
                                {formatCount(run.rowDelta)}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                            {run.status === "FAILED" &&
                            run.errorMessage?.toLowerCase().includes("timeout")
                              ? "60s (Timeout)"
                              : (run.durationLabel ?? "-")}
                          </td>
                          <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                            <div className="flex flex-col">
                              <span>{formatAbsolute(run.startedAt)}</span>
                              <span className="text-xs">{formatRelative(run.startedAt)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">{deliveryPill(run)}</td>
                          <td className="px-4 py-3 text-right">
                            {run.canDownload ? (
                              <button
                                type="button"
                                className={primaryButtonClassName}
                                disabled={downloadingId === run.id}
                                onClick={() => void handleDownload(run)}
                              >
                                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                                {downloadingId === run.id ? "Opening…" : "Download"}
                              </button>
                            ) : run.status === "FAILED" ? (
                              <button
                                type="button"
                                className={secondaryButtonClassName}
                                onClick={() => void handleRunNow()}
                                disabled={busy}
                              >
                                Retry
                              </button>
                            ) : (
                              <Link
                                href={`/admin/reports/exports/${run.id}?source=report_run`}
                                className="text-sm font-medium text-[var(--admin-primary)] hover:underline"
                              >
                                Details
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-5 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                  <span>
                    Showing {detail.runs.length} of {formatCount(detail.runsPageInfo.totalCount)}{" "}
                    runs
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded p-1 hover:bg-[var(--admin-surface-low)] disabled:opacity-40"
                      disabled={!detail.runsPageInfo.hasPreviousPage || busy}
                      onClick={() => {
                        setRunsPage((p) => Math.max(1, p - 1));
                      }}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 hover:bg-[var(--admin-surface-low)] disabled:opacity-40"
                      disabled={!detail.runsPageInfo.hasNextPage || busy}
                      onClick={() => {
                        setRunsPage((p) => p + 1);
                      }}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-20 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            {detail.config.externalWarning ? (
              <div className="flex items-start gap-3 border-b border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-4 py-3">
                <ShieldAlert
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
                  aria-hidden="true"
                />
                <p className="text-xs leading-relaxed text-[var(--admin-on-surface-variant)]">
                  {detail.config.externalWarning}
                </p>
              </div>
            ) : null}
            <div className="flex flex-col gap-6 p-5">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Configuration
              </h2>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-[12px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                    Report
                  </h3>
                  <Link
                    href={detail.config.editBuilderHref}
                    className="text-xs text-[var(--admin-primary)] hover:underline"
                  >
                    Edit
                  </Link>
                </div>
                <p className="text-sm text-[var(--admin-on-surface)]">
                  {detail.config.reportTitle} ({detail.config.definitionKey})
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[12px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                    Filters
                  </h3>
                  <Link
                    href={detail.config.editBuilderHref}
                    className="text-xs text-[var(--admin-primary)] hover:underline"
                  >
                    Edit
                  </Link>
                </div>
                {detail.config.filterChips.length === 0 ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">No filters</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detail.config.filterChips.map((chip) => (
                      <div
                        key={chip.key}
                        className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-1.5 text-sm text-[var(--admin-on-surface-variant)]"
                      >
                        {chip.label} is{" "}
                        <span className="font-medium text-[var(--admin-on-surface)]">
                          {chip.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[12px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                    Columns
                  </h3>
                  <Link
                    href={detail.config.editBuilderHref}
                    className="text-xs text-[var(--admin-primary)] hover:underline"
                  >
                    Edit
                  </Link>
                </div>
                <p className="mb-2 text-sm text-[var(--admin-on-surface)]">
                  {detail.config.columnCount > 0
                    ? `${detail.config.columnCount} columns selected`
                    : "Default columns"}
                </p>
                {detail.config.columns.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.config.columns.slice(0, 6).map((col) => (
                      <span
                        key={col}
                        className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-xs text-[var(--admin-on-surface-variant)]"
                      >
                        {col}
                      </span>
                    ))}
                    {detail.config.columns.length > 6 ? (
                      <span className="flex items-center text-xs text-[var(--admin-on-surface-variant)]">
                        ... {detail.config.columns.length - 6} more
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-[var(--admin-border)] pt-4">
                <div>
                  <h3 className="mb-1 text-[12px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                    Format
                  </h3>
                  <p className="text-sm text-[var(--admin-on-surface)]">
                    {detail.config.formatOptionsLabel ?? detail.config.format.toUpperCase()}
                  </p>
                </div>
                <div>
                  <h3 className="mb-1 text-[12px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                    Row limit
                  </h3>
                  <p className="text-sm text-[var(--admin-on-surface)]">
                    {detail.config.rowLimit != null
                      ? formatCount(detail.config.rowLimit)
                      : "No limit"}
                  </p>
                </div>
                <div className="col-span-2">
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="text-[12px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                      Cadence
                    </h3>
                    <Link
                      href={detail.config.editBuilderHref}
                      className="text-xs text-[var(--admin-primary)] hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                  <p className="text-sm text-[var(--admin-on-surface)]">
                    {detail.config.cadenceLabel}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                    {detail.config.cronExpression}
                  </p>
                </div>
                <div className="col-span-2">
                  <h3 className="mb-1 text-[12px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                    Retention
                  </h3>
                  <p className="text-sm text-[var(--admin-on-surface)]">
                    {detail.config.retentionDays != null
                      ? `${detail.config.retentionDays} days`
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {deleteOpen ? (
        <DeleteModal
          name={detail.name}
          cadence={detail.cadenceLabel}
          destination={destinationLabel}
          pastRuns={detail.stats.totalRuns}
          busy={busy}
          onCancel={() => {
            setDeleteOpen(false);
          }}
          onConfirm={() => {
            void handleDelete();
          }}
        />
      ) : null}
    </div>
  );
}
