"use client";

import Link from "next/link";
import { Download, Lock, RefreshCw } from "lucide-react";
import type { ReportInitialDataInRange } from "../../../lib/server/report-initial-data";
import {
  EXPORTS_HISTORY_DEFAULTS,
  type ExportsHistoryColumnKey,
  type ExportsHistoryDatePreset,
  type ExportsHistoryItem,
  type ExportsHistoryPayload,
  type ExportsHistorySummary,
} from "./admin-exports-roster-api";
import { useViewerLocale, type ViewerLocale } from "./viewer-time";

export type DatePreset = ExportsHistoryDatePreset;

export type SavedView = "all" | "failed" | "running" | "expiring" | "mine";

export type ModuleTab = "history" | "new" | "schedules" | "destinations" | "settings";

export const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

export const fieldClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

export const DEFAULT_COLUMNS: ExportsHistoryColumnKey[] = [...EXPORTS_HISTORY_DEFAULTS.columns];

export const EMPTY_SUMMARY: ExportsHistorySummary = {
  totalCount: 0,
  succeededCount: 0,
  failedCount: 0,
  pendingCount: 0,
  filesAvailableCount: 0,
  expiringSoonCount: 0,
  oldestPendingTitle: null,
};

export function formatCount(value: number, viewer: ViewerLocale): string {
  return value.toLocaleString(viewer.locale);
}

export function formatAbsolute(value: string | null, viewer: ViewerLocale): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  // The viewer's local time, or UTC until hydration ends (see viewer-time).
  const utc = viewer.timeZone === "UTC";
  const y = utc ? date.getUTCFullYear() : date.getFullYear();
  const m = String((utc ? date.getUTCMonth() : date.getMonth()) + 1).padStart(2, "0");
  const d = String(utc ? date.getUTCDate() : date.getDate()).padStart(2, "0");
  const hh = String(utc ? date.getUTCHours() : date.getHours()).padStart(2, "0");
  const mm = String(utc ? date.getUTCMinutes() : date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

export function formatRelative(value: string | null, viewer: ViewerLocale): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = viewer.now - date.getTime();
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

export function statusLabel(status: string): string {
  switch (status) {
    case "QUEUED":
      return "Queued";
    case "RUNNING":
      return "Running";
    case "SUCCEEDED":
      return "Succeeded";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function statusPillClass(status: string): string {
  if (status === "SUCCEEDED") {
    return "border-[color-mix(in_srgb,var(--admin-success)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (status === "FAILED") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  if (status === "QUEUED" || status === "RUNNING") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
}

export function sourceLabel(sourceType: ExportsHistoryItem["sourceType"]): string {
  return sourceType === "report_run" ? "Report run" : "Export job";
}

export function isExpired(expiresAt: string | null, now: number): boolean {
  if (!expiresAt) return false;
  const date = new Date(expiresAt);
  return !Number.isNaN(date.getTime()) && date.getTime() <= now;
}

export function isExpiringSoon(expiresAt: string | null, now: number): boolean {
  if (!expiresAt) return false;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return false;
  const ms = date.getTime() - now;
  return ms > 0 && ms <= 48 * 60 * 60 * 1000;
}

export function Shimmer({ className }: { className: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded bg-[var(--admin-surface-high)] ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--admin-surface)_65%,transparent)] to-transparent motion-reduce:animate-none" />
    </div>
  );
}

export function ExportsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading export history">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <div className="relative col-span-1 overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-2">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-primary-strong)]" />
          <Shimmer className="mb-2 h-3 w-24" />
          <Shimmer className="mb-3 h-9 w-20" />
          <Shimmer className="h-3 w-32" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <Shimmer className="mb-2 h-3 w-20" />
            <Shimmer className="mb-3 h-7 w-14" />
            <Shimmer className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
        <div className="mb-4 flex gap-2">
          <Shimmer className="h-7 w-24 rounded-full" />
          <Shimmer className="h-7 w-20 rounded-full" />
          <Shimmer className="h-7 w-28 rounded-full" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Shimmer className="h-9 w-full max-w-xs" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-40" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
          <Shimmer className="h-3 w-[12%]" />
          <Shimmer className="h-3 w-[14%]" />
          <Shimmer className="h-3 w-[28%]" />
          <Shimmer className="h-3 w-[10%]" />
          <Shimmer className="h-3 w-[10%]" />
          <Shimmer className="h-3 w-[14%]" />
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
            style={{ animationDelay: `${String(index * 40)}ms` }}
          >
            <Shimmer className="h-4 w-4 rounded" />
            <Shimmer className="h-5 w-20 rounded-full" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-4 w-12" />
            <Shimmer className="h-4 w-10" />
            <Shimmer className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatusCell({ item }: { item: ExportsHistoryItem }) {
  if (item.status === "RUNNING") {
    const pct = item.progressPercent;
    return (
      <div className="flex min-w-[140px] items-center gap-2">
        <span
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[color-mix(in_srgb,var(--admin-primary)_30%,transparent)] border-t-[var(--admin-primary-strong)] motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
          <div
            className="h-full rounded-full bg-[var(--admin-primary-strong)] transition-[width] duration-200 ease-out"
            style={{ width: pct == null ? "40%" : `${String(pct)}%` }}
          />
        </div>
        <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)]">
          {pct == null ? "…" : `${String(pct)}%`}
        </span>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide ${statusPillClass(item.status)}`}
    >
      {statusLabel(item.status)}
    </span>
  );
}

export function FileAffordance({
  item,
  downloading,
  onDownload,
}: {
  item: ExportsHistoryItem;
  downloading: boolean;
  onDownload: () => void;
}) {
  const viewer = useViewerLocale();
  const detailHref = `/admin/reports/exports/${item.id}?source=${item.sourceType}`;

  if (item.status === "QUEUED" || item.status === "RUNNING") {
    return (
      <Link
        href={detailHref}
        className="text-sm font-medium text-[var(--admin-primary)] hover:text-[var(--admin-primary-strong)] hover:underline"
      >
        View run
      </Link>
    );
  }

  if (item.status === "FAILED") {
    const retryHref = item.definitionKey
      ? `/admin/reports/exports/new?definition=${encodeURIComponent(item.definitionKey)}`
      : "/admin/reports/exports/new";
    return (
      <div className="flex items-center justify-end gap-3">
        <Link
          href={detailHref}
          className="text-sm font-medium text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)] hover:underline"
        >
          Details
        </Link>
        <Link
          href={retryHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-on-surface)] transition-colors hover:text-[var(--admin-primary)]"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Link>
      </div>
    );
  }

  if (item.status === "SUCCEEDED" && item.canDownload) {
    return (
      <div className="flex items-center justify-end gap-3">
        <Link
          href={detailHref}
          className="text-sm text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)] hover:underline"
        >
          Details
        </Link>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-primary)] transition-colors hover:text-[var(--admin-primary-strong)] disabled:opacity-50"
          disabled={downloading}
          onClick={onDownload}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          {downloading ? "Opening…" : "Download"}
        </button>
      </div>
    );
  }

  if (item.status === "SUCCEEDED" && item.hasFile && !item.canDownload) {
    return (
      <span
        className="inline-flex items-center gap-1 text-sm text-[var(--admin-on-surface-variant)]"
        title="Only the requester and owners can download this file"
      >
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Restricted
      </span>
    );
  }

  if (item.status === "SUCCEEDED" && !item.hasFile) {
    const rerunHref = item.definitionKey
      ? `/admin/reports/exports/new?definition=${encodeURIComponent(item.definitionKey)}`
      : "/admin/reports/exports/new";
    return (
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-[var(--admin-on-surface-variant)]">
          Removed{item.expiresAt ? ` ${formatAbsolute(item.expiresAt, viewer).slice(0, 10)}` : ""}
        </span>
        <Link
          href={rerunHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-on-surface)] transition-colors hover:text-[var(--admin-primary)]"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Re-run
        </Link>
      </div>
    );
  }

  return <span className="text-sm text-[var(--admin-on-surface-variant)]">-</span>;
}

export type ExportsRosterProps = {
  /**
   * The first page of exports, loaded by the server over the date range it
   * counted; the first browser load is skipped when present.
   */
  initialHistory?: ReportInitialDataInRange<ExportsHistoryPayload> | null;
};
