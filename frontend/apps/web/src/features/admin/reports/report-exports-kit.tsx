"use client";

import { useId, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import type { ReportExportHistoryItem } from "./admin-report-exports-api";

/*
 * The pieces every report's exports page and new-export dialog are built
 * from: the switch, the progress bar, the failure drawer, the ready toast and
 * the history-table cells.
 */

/** The footnote for reports whose payload note is written for operators, not admins. */
export const EXPORT_LINK_EXPIRY_NOTE =
  "Download links expire after the artifact TTL. Re-run an export or use a scheduled delivery to receive a fresh signed URL when files expire.";

export function formatExportRelative(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatExportUtc(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "Z");
}

export function exportRowCount(item: ReportExportHistoryItem): string {
  return item.rowCount == null ? "-" : item.rowCount.toLocaleString();
}

export type ExportRowState = {
  building: boolean;
  ready: boolean;
  expired: boolean;
  failed: boolean;
};

export function exportRowState(item: ReportExportHistoryItem): ExportRowState {
  return {
    building: item.status === "QUEUED" || item.status === "RUNNING",
    ready: item.status === "SUCCEEDED" && !item.expired,
    expired: item.status === "SUCCEEDED" && item.expired,
    failed: item.status === "FAILED",
  };
}

/** How a dataset's chip reads in the history table. */
export type ExportDatasetTone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "primary-soft"
  | "success-soft"
  | "muted"
  | "neutral";

const DATASET_TONE_CLASS_NAMES: Record<ExportDatasetTone, string> = {
  primary:
    "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]",
  success:
    "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]",
  warning:
    "bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]",
  danger:
    "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]",
  "primary-soft":
    "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface-high))] text-[var(--admin-on-surface)]",
  "success-soft":
    "bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface-high))] text-[var(--admin-on-surface)]",
  muted:
    "bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_14%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]",
  neutral: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
};

export function PolicyToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        onChange(!checked);
      }}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:opacity-50 ${
        checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-[var(--admin-surface)] shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function DeterminateProgressBar({ percent }: { percent: number | null }) {
  const value = percent == null ? null : Math.min(100, Math.max(0, percent));
  if (value == null) {
    return (
      <div
        className="mt-2 h-0.5 w-full overflow-hidden rounded-sm bg-[var(--admin-surface-high)]"
        role="progressbar"
        aria-valuetext="Building export"
      >
        <div className="h-full w-full animate-pulse bg-[var(--admin-primary)]" />
      </div>
    );
  }
  return (
    <div
      className="mt-2 h-0.5 w-full overflow-hidden rounded-sm bg-[var(--admin-surface-high)]"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Export ${value}% complete`}
    >
      <div
        className="h-full bg-[var(--admin-primary)] transition-[width] duration-300 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

/** The file name without its extension, followed by the format. */
export function ExportFileName({
  item,
  wrap = false,
}: {
  item: ReportExportHistoryItem;
  wrap?: boolean;
}) {
  const { expired } = exportRowState(item);
  return (
    <div className={`flex ${wrap ? "flex-wrap " : ""}items-center gap-2`}>
      <span
        className={`font-mono text-[13px] ${
          expired
            ? "text-[var(--admin-on-surface-variant)] line-through"
            : "text-[var(--admin-on-surface)]"
        }`}
      >
        {item.fileName.replace(/\.(csv|xlsx|json|pdf)$/i, "")}
      </span>
      <span className="inline-flex h-6 items-center rounded-sm bg-[var(--admin-surface-high)] px-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)] uppercase">
        {item.format}
      </span>
    </div>
  );
}

export function ExportBuildProgress({ item }: { item: ReportExportHistoryItem }) {
  return exportRowState(item).building ? (
    <DeterminateProgressBar percent={item.progressPercent} />
  ) : null;
}

export function ExportDatasetChip({
  label,
  tone,
  className = "",
}: {
  label: string;
  tone: ExportDatasetTone;
  className?: string;
}) {
  return (
    <span
      className={`${className ? `${className} ` : ""}inline-flex h-6 items-center rounded-sm px-2 text-[11px] font-semibold tracking-wide uppercase ${DATASET_TONE_CLASS_NAMES[tone]}`}
    >
      {label}
    </span>
  );
}

const sectionLabelClassName =
  "mb-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase";

export function ExportFailureDrawer({
  item,
  onClose,
  onRetry,
  busy,
}: {
  item: ReportExportHistoryItem;
  onClose: () => void;
  onRetry: () => void;
  busy: boolean;
}) {
  const titleId = useId();
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-md flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
      >
        <div className="flex items-start gap-4 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] text-[var(--admin-danger)]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              Export failed
            </h2>
            <p className="mt-1 truncate font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
              {item.fileName}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <p className={sectionLabelClassName}>Error reason</p>
            <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 font-mono text-[13px] break-words text-[var(--admin-on-surface)]">
              {item.errorMessage ?? item.errorCode ?? "Unknown export failure."}
            </div>
          </div>

          {item.errorTrace && item.errorTrace.length > 0 ? (
            <div>
              <p className={sectionLabelClassName}>Execution trace</p>
              <pre className="max-h-56 overflow-auto rounded-sm border border-[var(--admin-border)] bg-[var(--admin-code-bg)] p-4 font-mono text-[11px] leading-relaxed text-[var(--admin-code-fg)]">
                {item.errorTrace.join("\n")}
              </pre>
            </div>
          ) : null}

          <div>
            <p className={sectionLabelClassName}>Configuration</p>
            <dl className="space-y-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--admin-on-surface-variant)]">Dataset</dt>
                <dd className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {item.datasetLabel}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--admin-on-surface-variant)]">Scope</dt>
                <dd className="max-w-[200px] truncate text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {item.scopeLabel}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--admin-on-surface-variant)]">Format</dt>
                <dd className="font-mono text-[13px] uppercase text-[var(--admin-on-surface)]">
                  {item.format}
                </dd>
              </div>
              {item.requestedByLabel !== undefined ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--admin-on-surface-variant)]">Requested by</dt>
                  <dd className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                    {item.requestedByLabel || "-"}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="mb-1 text-[var(--admin-on-surface-variant)]">Columns</dt>
                <dd className="font-mono text-[12px] leading-relaxed break-words text-[var(--admin-on-surface)]">
                  {item.columns.length > 0 ? item.columns.join(", ") : "-"}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6">
          <button type="button" onClick={onClose} className={`${ghostButtonClassName} h-10`}>
            Close
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className={`${primaryButtonClassName} h-10 gap-2`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Retry export
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExportsSkeleton({ padded = true }: { padded?: boolean }) {
  return (
    <div className={padded ? "space-y-6 p-4 md:p-8" : "space-y-6"}>
      <div className="h-8 w-56 animate-pulse rounded-sm bg-[var(--admin-surface-high)]" />
      <div className="h-10 w-full animate-pulse rounded-sm bg-[var(--admin-surface-high)]" />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="h-80 animate-pulse rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-8" />
        <div className="h-80 animate-pulse rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-4" />
      </div>
    </div>
  );
}

export function ExportReadyToast({
  fileName,
  onDownload,
  onDismiss,
}: {
  fileName: string;
  onDownload: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-lg">
      <CheckCircle2 className="h-5 w-5 text-[var(--admin-success)]" aria-hidden="true" />
      <span className="text-sm text-[var(--admin-on-surface)]">
        <span className="font-mono text-[13px]">{fileName}</span> is ready
      </span>
      <button
        type="button"
        className="text-sm font-semibold text-[var(--admin-primary)]"
        onClick={onDownload}
      >
        Download
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** One column of the history table, before the shared Status and Action columns. */
export type ExportHistoryColumn<TItem extends ReportExportHistoryItem> = {
  heading: string;
  /** Classes for the cell. The first column's cell also carries the health rail. */
  className: string;
  render: (item: TItem) => ReactNode;
};

/**
 * The File, Dataset & scope and Details columns most reports use. `details`
 * adds lines under the row count, such as who asked for the file.
 */
export function standardExportColumns<TItem extends ReportExportHistoryItem>({
  datasetTone,
  expiredCaption,
  details,
}: {
  datasetTone: (dataset: TItem["dataset"]) => ExportDatasetTone;
  expiredCaption: string;
  details?: (item: TItem) => ReactNode;
}): Array<ExportHistoryColumn<TItem>> {
  return [
    {
      heading: "File",
      className: "px-4 py-3 whitespace-nowrap",
      render: (item) => (
        <>
          <ExportFileName item={item} />
          <ExportBuildProgress item={item} />
        </>
      ),
    },
    {
      heading: "Dataset & scope",
      className: "max-w-[220px] px-4 py-3",
      render: (item) => (
        <>
          <ExportDatasetChip
            className="mb-1"
            label={item.datasetLabel}
            tone={datasetTone(item.dataset)}
          />
          <p className="truncate text-sm text-[var(--admin-on-surface-variant)]">
            {item.scopeLabel}
          </p>
        </>
      ),
    },
    {
      heading: "Details",
      className: "px-4 py-3 whitespace-nowrap",
      render: (item) => (
        <>
          <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
            {exportRowCount(item)} rows
            {item.sizeLabel ? ` · ${item.sizeLabel}` : ""}
          </div>
          {details?.(item)}
          <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
            {formatExportRelative(item.createdAt)}
          </div>
          <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {formatExportUtc(item.createdAt)}
          </div>
          {exportRowState(item).expired ? (
            <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
              {expiredCaption}
            </p>
          ) : null}
        </>
      ),
    },
  ];
}
