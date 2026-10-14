"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MoreVertical, Trash2, X } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  dropdownItemClassName,
  dropdownPanelSurfaceClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import type { ReportExportHistoryItem } from "./admin-report-exports-api";
import type { ExportHistoryColumn } from "./report-exports-kit";
import { LocalCount, LocalDateTime, RelativeTime } from "./viewer-time";

/*
 * The pieces of the insights look for exports pages (Live class attendance,
 * Resource usage, Super live insights, Zoom insights): status pills, the
 * failure popover, the schedule menu, the ready toast and the history cells.
 */

/** Render it through RelativeTime, which picks `now` so a server-rendered page hydrates cleanly. */
export function formatInsightRelative(value: string | null, now: number): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = now - date.getTime();
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function insightStatusLabel(item: ReportExportHistoryItem): string {
  if (item.status === "SUCCEEDED" && item.expired) return "Expired";
  if (item.status === "SUCCEEDED") return "Ready";
  if (item.status === "RUNNING") return "Building";
  if (item.status === "QUEUED") return "Queued";
  if (item.status === "FAILED") return "Failed";
  return "Cancelled";
}

export function insightStatusPillClassName(item: ReportExportHistoryItem): string {
  const label = insightStatusLabel(item);
  if (label === "Ready") {
    return "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (label === "Building") {
    return "border-[var(--admin-primary-strong)] bg-[color-mix(in_srgb,var(--admin-primary-strong)_10%,var(--admin-surface))] text-[var(--admin-primary-strong)]";
  }
  if (label === "Queued") {
    return "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (label === "Failed") {
    return "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  return "border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

export const insightDatasetChipClassName =
  "rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-2 py-1 text-[12px] text-[var(--admin-on-surface-variant)]";

export const insightFormatChipClassName =
  "rounded-sm bg-[var(--admin-surface-high)] px-1.5 py-0.5 text-[12px] text-[var(--admin-on-surface-variant)]";

function InsightFileName({ item }: { item: ReportExportHistoryItem }) {
  const expired = item.status === "SUCCEEDED" && item.expired;
  return (
    <div className="flex items-center gap-2">
      <span
        className={`font-mono text-[13px] ${
          expired
            ? "text-[var(--admin-on-surface-variant)] line-through"
            : "text-[var(--admin-on-surface)]"
        }`}
      >
        {item.fileName}
      </span>
      <span className={insightFormatChipClassName}>{item.format.toUpperCase()}</span>
    </div>
  );
}

type InsightColumn = ExportHistoryColumn<ReportExportHistoryItem> & { align?: "right" };

/** The history columns the insights look offers; each report picks the ones it shows. */
export const INSIGHT_EXPORT_COLUMNS = {
  file: {
    heading: "File",
    className: "px-4 py-2 whitespace-nowrap",
    render: (item) => <InsightFileName item={item} />,
  },
  /** The file with its dataset under it, for reports that skip the Dataset column. */
  fileWithDataset: {
    heading: "File & Format",
    className: "px-4 py-2 whitespace-nowrap",
    render: (item) => (
      <>
        <InsightFileName item={item} />
        <span className={`mt-1 inline-block ${insightDatasetChipClassName}`}>
          {item.datasetLabel}
        </span>
      </>
    ),
  },
  dataset: {
    heading: "Dataset",
    className: "px-4 py-2 whitespace-nowrap",
    render: (item) => <span className={insightDatasetChipClassName}>{item.datasetLabel}</span>,
  },
  scope: {
    heading: "Scope",
    className: "max-w-[150px] truncate px-4 py-2 text-sm text-[var(--admin-on-surface-variant)]",
    render: (item) => item.scopeLabel,
  },
  rows: {
    heading: "Rows",
    align: "right",
    className: "px-4 py-2 text-right font-mono text-[13px] text-[var(--admin-on-surface)]",
    render: (item) => (item.rowCount == null ? "-" : <LocalCount value={item.rowCount} />),
  },
  size: {
    heading: "Size",
    align: "right",
    className: "px-4 py-2 text-right font-mono text-[13px] text-[var(--admin-on-surface)]",
    render: (item) => item.sizeLabel ?? "-",
  },
  created: {
    heading: "Created",
    className: "px-4 py-2 whitespace-nowrap",
    render: (item) => (
      <>
        <div className="text-sm text-[var(--admin-on-surface)]">
          <RelativeTime value={item.createdAt} format={formatInsightRelative} />
        </div>
        <div className="text-[12px] text-[var(--admin-on-surface-variant)]">
          <LocalDateTime value={item.createdAt} />
        </div>
      </>
    ),
  },
} satisfies Record<string, InsightColumn>;

export type InsightExportColumn = InsightColumn;

export function InsightFailurePopover({
  item,
  onClose,
  onRetry,
  onRetryAsCsv,
  busy,
}: {
  item: ReportExportHistoryItem;
  onClose: () => void;
  onRetry: () => void;
  /** Offered for a non-CSV export when the report can retry in another format. */
  onRetryAsCsv?: (() => void) | undefined;
  busy: boolean;
}) {
  const titleId = useId();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="mb-3 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" />
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-sm font-semibold text-[var(--admin-on-surface)]">
              Export failed
            </h3>
            <p className="mt-1 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
              {item.fileName}
            </p>
            <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
              {item.errorMessage ?? item.errorCode ?? "Export generation failed."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className={`${ghostButtonClassName} h-9`}>
            Close
          </button>
          {onRetryAsCsv && item.format !== "csv" ? (
            <button
              type="button"
              onClick={onRetryAsCsv}
              disabled={busy}
              className={`${ghostButtonClassName} h-9 gap-2`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Retry as CSV
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className={`${primaryButtonClassName} h-9 gap-2`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

export function InsightScheduleMenu({
  scheduleName,
  busy,
  onRunNow,
  onDelete,
}: {
  scheduleName: string;
  busy: boolean;
  onRunNow: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`Actions for ${scheduleName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div
          className={`absolute top-9 right-0 z-20 w-44 bg-[var(--admin-surface)] shadow-lg ${dropdownPanelSurfaceClassName}`}
          role="menu"
        >
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              className={dropdownItemClassName}
              onClick={() => {
                setOpen(false);
                onRunNow();
              }}
            >
              Run now
            </button>
            <button
              type="button"
              role="menuitem"
              className={`${dropdownItemClassName} text-[var(--admin-danger)]`}
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function InsightExportsSkeleton({ padded = true }: { padded?: boolean }) {
  return (
    <div
      className={
        padded
          ? "mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-8"
          : "flex flex-col gap-6"
      }
      aria-busy="true"
    >
      <div className="h-8 w-56 animate-pulse rounded-sm bg-[var(--admin-surface-high)]" />
      <div className="h-10 w-full animate-pulse rounded-sm bg-[var(--admin-surface-high)]" />
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="h-80 animate-pulse rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-8" />
        <div className="h-80 animate-pulse rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-4" />
      </div>
    </div>
  );
}

export function InsightReadyToast({
  fileName,
  onDownload,
}: {
  fileName: string;
  onDownload: () => void;
}) {
  return (
    <div className="fixed right-6 bottom-6 z-50 flex max-w-sm items-center rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-on-surface)] px-4 py-3 text-[var(--admin-surface)] shadow-lg motion-safe:animate-[admin-dropdown-in_0.4s_cubic-bezier(0.16,1,0.3,1)]">
      <CheckCircle2 className="mr-3 h-5 w-5 shrink-0 text-[var(--admin-success)]" />
      <div className="mr-4 flex-1 text-sm">
        <span className="font-mono text-[13px]">{fileName}</span> is ready.
      </div>
      <button
        type="button"
        onClick={onDownload}
        className="text-[12px] font-semibold tracking-wider text-[var(--admin-primary-container)] uppercase hover:opacity-90 active:translate-y-px"
      >
        Download
      </button>
    </div>
  );
}
