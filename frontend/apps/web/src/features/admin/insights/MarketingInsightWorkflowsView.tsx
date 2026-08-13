"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  GitBranch,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { ADMIN_INSIGHTS_HREF, adminInsightHref } from "./admin-insights-catalog";
import type {
  InsightMarketingWorkflowsBoard,
  InsightMarketingWorkflowsLedgerRow,
} from "./admin-insights-api";
import { csvEscape, formatInsightNumber, formatRelativeTime } from "./admin-insights-format";
import {
  insightBreadcrumbClassName,
  insightGhostButtonClassName,
  insightKpiLabelClassName,
  insightKpiValueClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPageTitleClassName,
  insightPanelClassName,
  insightPrimaryButtonClassName,
  insightShimmerClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";
import { marketingStatusTone, type MarketingStatusTone } from "./marketing-insight-meta";

type Props = {
  slug: string;
  sectionTitle: string;
  board: InsightMarketingWorkflowsBoard | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

function statusPillClass(tone: MarketingStatusTone): string {
  if (tone === "success") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (tone === "danger") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  if (tone === "warning") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
}

function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function workflowsCsv(board: InsightMarketingWorkflowsBoard): string {
  const lines = [
    ["Metric", "Value"].map(csvEscape).join(","),
    ["Runs (30d)", board.runs30d].map(csvEscape).join(","),
    ["Published workflows", board.publishedWorkflowCount].map(csvEscape).join(","),
    ["Failed runs (30d)", board.runsFailed30d].map(csvEscape).join(","),
    ["Success rate %", board.successRatePct == null ? "-" : `${board.successRatePct}%`]
      .map(csvEscape)
      .join(","),
    ["Last run", board.lastRunAt ?? "Never"].map(csvEscape).join(","),
    "",
    ["Workflow", "Status", "Runs (30d)", "Failed (30d)", "Success rate %", "Last run"]
      .map(csvEscape)
      .join(","),
    ...board.byWorkflow.map((row) =>
      [
        row.title,
        row.status,
        row.runs30d,
        row.failed30d,
        row.successRatePct == null ? "-" : `${row.successRatePct}%`,
        row.lastRunAt ?? "Never",
      ]
        .map(csvEscape)
        .join(","),
    ),
    "",
    ["Workflow", "Status", "Trigger", "Created", "Error"].map(csvEscape).join(","),
    ...board.ledger.map((row) =>
      [row.workflowTitle, row.status, row.triggerEventType, row.createdAt, row.errorPreview ?? ""]
        .map(csvEscape)
        .join(","),
    ),
  ];
  return lines.join("\n");
}

function Shimmer({ className, widthPct }: { className: string; widthPct?: number }) {
  return (
    <div
      className={`${insightShimmerClassName} ${className}`}
      style={widthPct != null ? { width: `${String(widthPct)}%` } : undefined}
    />
  );
}

function WorkflowsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading workflows">
      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] md:grid-cols-12 md:divide-x md:divide-y-0">
          {Array.from({ length: 5 }).map((_, index) => (
            <section
              key={String(index)}
              className={`flex min-w-0 flex-col gap-2 p-5 md:p-6 ${index === 0 ? "md:col-span-4" : "md:col-span-2"}`}
            >
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-8 w-20" />
              <Shimmer className="h-3 w-32" />
            </section>
          ))}
        </div>
      </div>
      <section className={`${insightPanelClassName} p-6`}>
        <Shimmer className="mb-4 h-4 w-32" />
        <Shimmer className="h-32 w-full" />
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className={`${insightPanelClassName} p-5 lg:col-span-7`}>
          <Shimmer className="mb-4 h-5 w-36" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Shimmer key={String(index)} className="mb-3 h-10 w-full" />
          ))}
        </section>
        <div className="flex flex-col gap-6 lg:col-span-5">
          <section className={`${insightPanelClassName} p-5`}>
            <Shimmer className="mb-4 h-5 w-24" />
            {Array.from({ length: 4 }).map((_, index) => (
              <Shimmer key={String(index)} className="mb-3 h-8 w-full" />
            ))}
          </section>
          <section className={`${insightPanelClassName} p-5`}>
            <Shimmer className="mb-4 h-5 w-40" />
            <Shimmer className="h-16 w-full" />
          </section>
        </div>
      </div>
      <section className={`${insightPanelClassName} p-5`}>
        <Shimmer className="mb-4 h-5 w-28" />
        {Array.from({ length: 8 }).map((_, index) => (
          <Shimmer key={String(index)} className="mb-3 h-10 w-full" />
        ))}
      </section>
    </div>
  );
}

function ErrorStrip({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4">
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--admin-on-surface)]">{message}</p>
      </div>
      <button type="button" className={insightGhostButtonClassName} onClick={onRetry}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}

function ShareBar({
  pct,
  tone = "default",
}: {
  pct: number | null;
  tone?: "default" | "warning" | "success";
}) {
  if (pct == null || pct <= 0) return null;
  const fill =
    tone === "warning"
      ? "bg-[var(--admin-warning)]"
      : tone === "success"
        ? "bg-[var(--admin-success)]"
        : "bg-[var(--admin-primary)]";
  return (
    <div className="mt-1 h-[3px] w-full max-w-[80px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
      <div
        className={`h-full rounded-full ${fill}`}
        style={{ width: `${String(Math.min(pct, 100))}%` }}
      />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-data text-[11px] uppercase tracking-wide ${statusPillClass(marketingStatusTone(status))}`}
    >
      {status}
    </span>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPublishDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPeriodShort(period: string | undefined): string {
  if (!period) return "";
  const date = new Date(`${period}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function RunVolumePanel({ board }: { board: InsightMarketingWorkflowsBoard }) {
  const maxTotal = Math.max(...board.dailyVolume.map((day) => day.total), 1);

  return (
    <section className={`${insightPanelClassName} p-5 md:p-6`} aria-label="Run volume">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Run volume</h2>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            Daily workflow runs over the last 30 days.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--admin-on-surface-variant)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[var(--admin-primary)]" aria-hidden="true" />
            Completed
          </span>
          {!board.allHealthy ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm bg-[var(--admin-warning)]"
                aria-hidden="true"
              />
              Failed
            </span>
          ) : null}
        </div>
      </div>

      {board.allHealthy && board.volumeAllHealthyCaption ? (
        <div className="mb-4 flex items-center gap-2 rounded border border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] p-2">
          <CheckCircle2 className="h-4 w-4 text-[var(--admin-success)]" aria-hidden="true" />
          <span className="text-xs text-[var(--admin-success)]">
            {board.volumeAllHealthyCaption}
          </span>
        </div>
      ) : null}

      <div className="flex h-40 w-full items-end gap-1 border-b border-[var(--admin-border)] pb-1">
        {board.dailyVolume.map((day) => {
          if (day.total <= 0) {
            return (
              <div
                key={day.period}
                className="flex flex-1 flex-col items-center justify-end"
                title={`${day.period}: 0 runs`}
              >
                <div
                  className="h-3 w-2 rounded-sm border border-dashed border-[var(--admin-outline)] bg-transparent"
                  aria-hidden="true"
                />
              </div>
            );
          }

          const totalHeightPct = Math.max(8, (day.total / maxTotal) * 100);
          const failedHeightPct = day.failed > 0 ? (day.failed / day.total) * 100 : 0;
          const completedHeightPct = 100 - failedHeightPct;

          return (
            <div
              key={day.period}
              className="group flex flex-1 flex-col items-center justify-end"
              title={`${day.period}: ${String(day.total)} runs (${String(day.failed)} failed)`}
            >
              <div
                className="flex w-full max-w-[18px] flex-col justify-end overflow-hidden rounded-t-sm"
                style={{ height: `${String(totalHeightPct)}%` }}
              >
                {day.failed > 0 ? (
                  <div
                    className="w-full bg-[var(--admin-warning)]"
                    style={{ height: `${String(failedHeightPct)}%` }}
                    aria-hidden="true"
                  />
                ) : null}
                <div
                  className="w-full bg-[var(--admin-primary)]"
                  style={{ height: `${String(completedHeightPct)}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          );
        })}
      </div>

      {board.dailyVolume.length > 0 ? (
        <div className="mt-2 flex justify-between px-0.5 text-[10px] text-[var(--admin-on-surface-variant)]">
          <span>{formatPeriodShort(board.dailyVolume[0]?.period)}</span>
          <span>
            {formatPeriodShort(board.dailyVolume[Math.floor(board.dailyVolume.length / 2)]?.period)}
          </span>
          <span>{formatPeriodShort(board.dailyVolume[board.dailyVolume.length - 1]?.period)}</span>
        </div>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-[var(--admin-on-surface-variant)]">
        {board.volumeCaption}
      </p>
    </section>
  );
}

function ByWorkflowTable({ board }: { board: InsightMarketingWorkflowsBoard }) {
  return (
    <section
      className={`${insightPanelClassName} flex min-h-0 flex-col lg:col-span-7`}
      aria-label="Runs by workflow"
    >
      <header className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Runs by workflow</h2>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className={insightTableHeadClassName}>
            <tr>
              <th className="px-5 py-3 font-medium">Workflow</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Runs (30d)</th>
              <th className="px-3 py-3 font-medium">Failed</th>
              <th className="px-3 py-3 font-medium">Success rate</th>
              <th className="px-3 py-3 font-medium">Last run</th>
              <th className="w-8 px-3 py-3" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {board.byWorkflow.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-8 text-center text-[var(--admin-on-surface-variant)]"
                >
                  No workflow runs in this window.
                </td>
              </tr>
            ) : (
              board.byWorkflow.map((row) => (
                <tr
                  key={row.id}
                  className={`${insightTableRowClassName} group ${
                    row.warningRail ? "border-l-4 border-l-[var(--admin-warning)]" : ""
                  }`}
                >
                  <td className="px-5 py-3">
                    <Link
                      href={row.href}
                      prefetch={false}
                      className="font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                    >
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-data text-[var(--admin-on-surface)]">
                      {formatInsightNumber(row.runs30d)}
                    </span>
                    <ShareBar pct={row.runSharePct} />
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`font-data ${
                        row.failed30d > 0
                          ? "text-[var(--admin-warning)]"
                          : "text-[var(--admin-on-surface)]"
                      }`}
                    >
                      {formatInsightNumber(row.failed30d)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-data text-[var(--admin-on-surface)]">
                      {row.successRatePct == null ? "-" : `${row.successRatePct}%`}
                    </span>
                    <ShareBar pct={row.successRatePct} tone="success" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-data text-sm text-[var(--admin-on-surface)]">
                      {row.lastRunAt ? formatRelativeTime(row.lastRunAt) : "Never"}
                    </div>
                    {row.lastRunAt ? (
                      <div className="text-[10px] text-[var(--admin-on-surface-variant)]">
                        {formatDateTime(row.lastRunAt)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={row.href}
                      prefetch={false}
                      className="inline-flex rounded p-1 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--admin-on-surface)]"
                      aria-label={`Open ${row.title}`}
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TriggersPanel({ board }: { board: InsightMarketingWorkflowsBoard }) {
  return (
    <section className={`${insightPanelClassName} flex min-h-0 flex-col`} aria-label="Triggers">
      <header className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Triggers</h2>
      </header>
      <div className="divide-y divide-[var(--admin-border)]">
        {board.triggers.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
            No trigger events recorded in this window.
          </p>
        ) : (
          board.triggers.map((row) => (
            <div key={row.trigger} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-data text-sm text-[var(--admin-on-surface)]">
                  {row.trigger}
                </p>
                <ShareBar pct={row.sharePct} />
              </div>
              <span className="shrink-0 font-data text-sm text-[var(--admin-on-surface)]">
                {formatInsightNumber(row.runs)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function NeverRunPanel({ board }: { board: InsightMarketingWorkflowsBoard }) {
  return (
    <section
      className={`${insightPanelClassName} flex min-h-0 flex-col`}
      aria-label="Published but never run"
    >
      <header className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
          Published but never run
        </h2>
      </header>
      {board.neverRun.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
          {board.neverRunCaption}
        </p>
      ) : (
        <>
          <div className="divide-y divide-[var(--admin-border)]">
            {board.neverRun.map((row) => (
              <Link
                key={row.id}
                href={row.href}
                prefetch={false}
                className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-[var(--admin-surface-high)]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--admin-primary)]">{row.title}</p>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Published {formatPublishDate(row.publishedAt)}
                  </p>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
          <footer className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-3">
            <p className="text-xs leading-5 text-[var(--admin-on-surface-variant)]">
              {board.neverRunCaption}
            </p>
          </footer>
        </>
      )}
    </section>
  );
}

function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value)?.label ?? label;

  return (
    <div className="min-w-[9rem]">
      <DropdownField
        label={null}
        labelId={`${label}-filter`}
        open={open}
        onToggle={() => {
          setOpen((prev) => !prev);
        }}
        triggerContent={current}
        panelAriaLabel={label}
        portalZIndex={85}
      >
        <div className="max-h-64 overflow-y-auto bg-[var(--admin-surface)] p-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={dropdownItemClassName}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </DropdownField>
    </div>
  );
}

function LedgerRowMenu({ row }: { row: InsightMarketingWorkflowsLedgerRow }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const onCopyId = async () => {
    const ok = await copyText(row.id);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    }
    setOpen(false);
  };

  return (
    <div className="inline-flex">
      <DropdownField
        label={null}
        labelId={`run-menu-${row.id}`}
        open={open}
        onToggle={() => {
          setOpen((prev) => !prev);
        }}
        triggerContent={<MoreHorizontal className="h-5 w-5" aria-hidden="true" />}
        panelAriaLabel={`Actions for run ${row.id}`}
        portalZIndex={90}
      >
        <div className="min-w-[12rem] bg-[var(--admin-surface)] p-1">
          <Link
            href={row.workflowHref}
            prefetch={false}
            className={dropdownItemClassName}
            onClick={() => {
              setOpen(false);
            }}
          >
            Open workflow
          </Link>
          <Link
            href={row.href}
            prefetch={false}
            className={dropdownItemClassName}
            onClick={() => {
              setOpen(false);
            }}
          >
            View run
          </Link>
          <button type="button" className={dropdownItemClassName} onClick={() => void onCopyId()}>
            {copied ? "Copied run id" : "Copy run id"}
          </button>
        </div>
      </DropdownField>
    </div>
  );
}

function RunLedger({
  board,
  workflowFilter,
  statusFilters,
  triggerFilter,
  onWorkflowFilter,
  onStatusToggle,
  onTriggerFilter,
}: {
  board: InsightMarketingWorkflowsBoard;
  workflowFilter: string;
  statusFilters: Set<string>;
  triggerFilter: string;
  onWorkflowFilter: (value: string) => void;
  onStatusToggle: (status: string) => void;
  onTriggerFilter: (value: string) => void;
}) {
  const workflowOptions = useMemo(() => {
    const ids = new Map<string, string>();
    for (const row of board.ledger) ids.set(row.workflowId, row.workflowTitle);
    return [
      { value: "all", label: "All workflows" },
      ...[...ids.entries()].map(([value, label]) => ({ value, label })),
    ];
  }, [board.ledger]);

  const triggerOptions = useMemo(() => {
    const triggers = new Set(board.ledger.map((row) => row.triggerEventType));
    return [
      { value: "all", label: "All triggers" },
      ...[...triggers].sort().map((value) => ({ value, label: value })),
    ];
  }, [board.ledger]);

  const statusOptions = useMemo(() => {
    const statuses = [...new Set(board.ledger.map((row) => row.status))].sort();
    return statuses;
  }, [board.ledger]);

  const filtered = useMemo(
    () =>
      board.ledger.filter((row) => {
        if (workflowFilter !== "all" && row.workflowId !== workflowFilter) return false;
        if (triggerFilter !== "all" && row.triggerEventType !== triggerFilter) return false;
        if (statusFilters.size > 0 && !statusFilters.has(row.status)) return false;
        return true;
      }),
    [board.ledger, workflowFilter, triggerFilter, statusFilters],
  );

  return (
    <section
      id="workflows-run-ledger"
      className={`${insightPanelClassName} flex min-h-0 flex-col`}
      aria-label="Run ledger"
    >
      <header className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Run ledger</h2>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-3">
        <FilterDropdown
          label="Workflow"
          value={workflowFilter}
          options={workflowOptions}
          onChange={onWorkflowFilter}
        />
        <div className="flex min-w-[12rem] flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--admin-on-surface-variant)]">Status</span>
          {statusOptions.map((status) => {
            const active = statusFilters.size === 0 || statusFilters.has(status);
            const isFailed = status.toUpperCase() === "FAILED";
            return (
              <button
                key={status}
                type="button"
                className={`rounded border px-2 py-1 font-data text-[11px] uppercase tracking-wide transition-colors ${
                  active
                    ? isFailed
                      ? "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]"
                      : "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]"
                    : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] opacity-60"
                }`}
                onClick={() => {
                  onStatusToggle(status);
                }}
              >
                {status}
              </button>
            );
          })}
        </div>
        <FilterDropdown
          label="Trigger"
          value={triggerFilter}
          options={triggerOptions}
          onChange={onTriggerFilter}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className={insightTableHeadClassName}>
            <tr>
              <th className="px-5 py-3 font-medium">Workflow</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Trigger</th>
              <th className="px-3 py-3 font-medium">Created</th>
              <th className="w-10 px-3 py-3" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-8 text-center text-[var(--admin-on-surface-variant)]"
                >
                  No runs match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className={`${insightTableRowClassName} align-top ${
                    row.isFailed ? "border-l-4 border-l-[var(--admin-danger)]" : ""
                  }`}
                >
                  <td className="px-5 py-3">
                    <Link
                      href={row.workflowHref}
                      prefetch={false}
                      className="font-medium text-[var(--admin-primary)] outline-none hover:underline"
                    >
                      {row.workflowTitle}
                    </Link>
                    {row.errorPreview ? (
                      <p className="mt-1 line-clamp-1 text-xs text-[var(--admin-danger)]">
                        {row.errorPreview}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="px-3 py-3 font-data text-sm text-[var(--admin-on-surface)]">
                    {row.triggerEventType}
                  </td>
                  <td className="px-3 py-3 font-data text-sm text-[var(--admin-on-surface)]">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <LedgerRowMenu row={row} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyState({ board }: { board: InsightMarketingWorkflowsBoard }) {
  return (
    <section
      className={`${insightPanelClassName} flex flex-col items-center gap-4 px-6 py-16 text-center`}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
        <GitBranch className="h-8 w-8 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
      </div>
      <div>
        <p className="text-base font-medium text-[var(--admin-on-surface)]">{board.emptyCaption}</p>
        <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
          Marketing workflows automate follow-ups when learners sign up, submit forms, or hit other
          triggers. Publish a workflow to start collecting run history here.
        </p>
      </div>
      <Link
        href={board.manageWorkflowsHref}
        prefetch={false}
        className={insightPrimaryButtonClassName}
      >
        Manage workflows
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

export function MarketingInsightWorkflowsView({
  slug,
  sectionTitle,
  board,
  loading,
  error,
  onRefresh,
}: Props) {
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const csv = useMemo(() => (board ? workflowsCsv(board) : ""), [board]);

  useEffect(() => {
    setWorkflowFilter("all");
    setTriggerFilter("all");
    setStatusFilters(new Set());
  }, [board?.generatedAt]);

  const onCopyCsv = async () => {
    if (!csv) return;
    const ok = await copyText(csv);
    if (ok) {
      setCopiedCsv(true);
      window.setTimeout(() => {
        setCopiedCsv(false);
      }, 2000);
    }
  };

  const onStatusToggle = (status: string) => {
    setStatusFilters((prev) => {
      // Empty set means "all statuses". First click narrows to that status alone.
      if (prev.size === 0) {
        return new Set([status]);
      }
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const onFailedRunsClick = () => {
    setStatusFilters(new Set(["FAILED"]));
    const ledger = document.getElementById("workflows-run-ledger");
    ledger?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const successBarWidth = board?.successRatePct == null ? 0 : Math.min(board.successRatePct, 100);

  return (
    <div className={insightPageClassName} aria-busy={loading}>
      <nav className={insightBreadcrumbClassName} aria-label="Breadcrumb">
        <Link href="/admin" prefetch={false} className="hover:text-[var(--admin-on-surface)]">
          Admin
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <Link
          href={ADMIN_INSIGHTS_HREF}
          prefetch={false}
          className="hover:text-[var(--admin-on-surface)]"
        >
          Insights
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <Link
          href={adminInsightHref(slug)}
          prefetch={false}
          className="hover:text-[var(--admin-on-surface)]"
        >
          {sectionTitle}
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <span className="font-medium text-[var(--admin-on-surface)]">Workflows</span>
      </nav>

      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Link
              href={adminInsightHref(slug)}
              prefetch={false}
              className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              aria-label={`Back to ${sectionTitle}`}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className={insightPageTitleClassName}>{board?.title ?? "Workflows"}</h1>
          </div>
          <p className={insightPageDescClassName}>
            {board?.subtitle ?? "What the marketing automation has been doing."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!board || !csv}
            onClick={() => void onCopyCsv()}
          >
            {copiedCsv ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copiedCsv ? "Copied" : "Copy as CSV"}
          </button>
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!board || !csv}
            onClick={() => {
              if (!csv) return;
              downloadCsv("marketing-workflows.csv", csv);
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>
          <Link
            href={board?.manageWorkflowsHref ?? "/admin/marketing/workflows"}
            prefetch={false}
            className={insightPrimaryButtonClassName}
          >
            Manage workflows
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}
      {loading && !board ? <WorkflowsSkeleton /> : null}

      {board ? (
        board.empty ? (
          <EmptyState board={board} />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] md:grid-cols-12 md:divide-x md:divide-y-0">
                <section className="flex min-w-0 flex-col justify-between gap-2 p-5 md:col-span-4 md:p-6">
                  <p className={insightKpiLabelClassName}>Runs (30d)</p>
                  <p className={insightKpiValueClassName}>{formatInsightNumber(board.runs30d)}</p>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    {board.runsCaption}
                  </p>
                </section>
                <section className="flex min-w-0 flex-col justify-between gap-2 p-5 md:col-span-2 md:p-6">
                  <p className={insightKpiLabelClassName}>Published workflows</p>
                  <p className={insightKpiValueClassName}>
                    {formatInsightNumber(board.publishedWorkflowCount)}
                  </p>
                </section>
                <button
                  type="button"
                  className={`flex min-w-0 flex-col justify-between gap-2 p-5 text-left transition-colors md:col-span-2 md:p-6 ${
                    board.runsFailed30d > 0
                      ? "bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))]"
                      : ""
                  }`}
                  onClick={onFailedRunsClick}
                >
                  <p className={insightKpiLabelClassName}>Failed runs</p>
                  <p
                    className={`${insightKpiValueClassName} ${
                      board.runsFailed30d > 0 ? "text-[var(--admin-warning)]" : ""
                    }`}
                  >
                    {formatInsightNumber(board.runsFailed30d)}
                  </p>
                </button>
                <section className="flex min-w-0 flex-col justify-between gap-2 p-5 md:col-span-2 md:p-6">
                  <p className={insightKpiLabelClassName}>Success rate</p>
                  <p className={insightKpiValueClassName}>
                    {board.successRatePct == null ? "-" : `${board.successRatePct}%`}
                  </p>
                  <div className="h-[3px] w-full max-w-[120px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                    <div
                      className="h-full rounded-full bg-[var(--admin-success)]"
                      style={{ width: `${String(successBarWidth)}%` }}
                    />
                  </div>
                </section>
                <section className="flex min-w-0 flex-col justify-between gap-2 p-5 md:col-span-2 md:p-6">
                  <p className={insightKpiLabelClassName}>Last run</p>
                  <p className="font-data text-xl font-medium text-[var(--admin-on-surface)]">
                    {board.lastRunAt ? formatRelativeTime(board.lastRunAt) : "Never"}
                  </p>
                </section>
              </div>
            </div>

            <RunVolumePanel board={board} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <ByWorkflowTable board={board} />
              <div className="flex flex-col gap-6 lg:col-span-5">
                <TriggersPanel board={board} />
                <NeverRunPanel board={board} />
              </div>
            </div>

            <RunLedger
              board={board}
              workflowFilter={workflowFilter}
              statusFilters={statusFilters}
              triggerFilter={triggerFilter}
              onWorkflowFilter={setWorkflowFilter}
              onStatusToggle={onStatusToggle}
              onTriggerFilter={setTriggerFilter}
            />
          </>
        )
      ) : null}
    </div>
  );
}
