"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  Eye,
  Info,
  Minus,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import {
  ADMIN_INSIGHTS_HREF,
  adminInsightHref,
  adminInsightSettingsHref,
} from "./admin-insights-catalog";
import type {
  InsightSalesPipelineBoard,
  InsightSalesPipelineDropoff,
  InsightSalesPipelineStage,
  InsightSalesPipelineWindow,
} from "./admin-insights-api";
import { formatInsightNumber, formatRelativeTime } from "./admin-insights-format";
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

type SalesInsightPipelineViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightSalesPipelineBoard | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

const EMPTY_WIDTHS = [100, 86, 72] as const;

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

function csvEscape(value: string | number): string {
  const raw = String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function pipelineCsv(board: InsightSalesPipelineBoard): string {
  const lines = [
    [
      "Stage",
      "All-time count",
      "All-time conversion",
      "30-day count",
      "30-day conversion",
      "Difference",
    ]
      .map(csvEscape)
      .join(","),
  ];
  for (const stage of board.stages) {
    lines.push(
      [
        stage.label,
        stage.allTimeCount,
        stage.allTimeConvDisplay,
        stage.recentCount,
        stage.recentConvDisplay,
        stage.deltaDisplay,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

function deltaClass(display: string): string {
  if (display.startsWith("+")) return "text-[var(--admin-success)]";
  if (display.startsWith("-") && display !== "-") return "text-[var(--admin-danger)]";
  return "text-[var(--admin-on-surface-variant)]";
}

function stageIcon(key: InsightSalesPipelineStage["key"]): ReactNode {
  const className = "h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]";
  if (key === "visited") return <Eye className={className} aria-hidden="true" />;
  if (key === "started-diagnostic")
    return <ClipboardList className={className} aria-hidden="true" />;
  return <UserPlus className={className} aria-hidden="true" />;
}

function windowCount(
  window: InsightSalesPipelineWindow,
  key: InsightSalesPipelineStage["key"],
): number {
  if (key === "visited") return window.visited;
  if (key === "started-diagnostic") return window.startedDiagnostic;
  return window.enrolled;
}

function countLabel(
  window: InsightSalesPipelineWindow,
  key: InsightSalesPipelineStage["key"],
): string {
  const count = windowCount(window, key);
  if (window.empty && key !== "visited") return "-";
  return formatInsightNumber(count);
}

function barWidth(
  window: InsightSalesPipelineWindow,
  key: InsightSalesPipelineStage["key"],
  index: number,
): number {
  if (window.empty) return EMPTY_WIDTHS[index] ?? 72;
  const visited = Math.max(window.visited, 1);
  const count = windowCount(window, key);
  return Math.max((count / visited) * 100, count > 0 ? 8 : 0);
}

function Shimmer({ className, widthPct }: { className: string; widthPct?: number | undefined }) {
  return (
    <div
      className={`${insightShimmerClassName} ${className}`}
      style={widthPct != null ? { width: `${String(widthPct)}%` } : undefined}
    />
  );
}

function PipelineSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading sales pipeline">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <Shimmer className="mb-3 h-3 w-64" />
          <Shimmer className="mb-2 h-8 w-56" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-11 w-32" />
          <Shimmer className="h-11 w-28" />
          <Shimmer className="h-11 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-[var(--admin-border)] md:grid-cols-12">
        <div className="p-6 md:col-span-4">
          <Shimmer className="mb-3 h-3 w-40" />
          <Shimmer className="mb-4 h-9 w-24" />
          <Shimmer className="h-[3px] w-full" />
        </div>
        <div className="border-t border-[var(--admin-border)] p-6 md:col-span-3 md:border-l md:border-t-0">
          <Shimmer className="mb-3 h-3 w-32" />
          <Shimmer className="mb-4 h-9 w-20" />
          <Shimmer className="h-[3px] w-full" />
        </div>
        <div className="flex flex-col items-center justify-center border-t border-[var(--admin-border)] p-6 md:col-span-2 md:border-l md:border-t-0">
          <Shimmer className="mb-3 h-3 w-20" />
          <Shimmer className="h-8 w-24" />
        </div>
        <div className="border-t border-[var(--admin-border)] p-6 md:col-span-3 md:border-l md:border-t-0">
          <Shimmer className="mb-2 h-3 w-24" />
          <Shimmer className="mb-4 h-6 w-16" />
          <Shimmer className="mb-2 h-px w-full" />
          <Shimmer className="mb-2 h-3 w-24" />
          <Shimmer className="h-6 w-16" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {["all", "recent"].map((id) => (
          <section key={id} className={`${insightPanelClassName} p-6`}>
            <Shimmer className="mb-6 h-5 w-32" />
            <div className="space-y-4">
              {[100, 86, 72].map((width) => (
                <div key={width} className="space-y-2">
                  <div className="flex justify-between">
                    <Shimmer className="h-4 w-36" />
                    <Shimmer className="h-4 w-16" />
                  </div>
                  <Shimmer className="h-8" widthPct={width} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <section className={insightPanelClassName}>
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
          <Shimmer className="h-5 w-40" />
        </div>
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-5 last:border-b-0"
          >
            <Shimmer className="h-4 w-40" />
            <Shimmer className="ml-auto h-4 w-16" />
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-4 w-16" />
          </div>
        ))}
      </section>
    </div>
  );
}

function ErrorStrip({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-4 rounded border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]">
        <AlertCircle className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-[var(--admin-danger)]">
          Unable to load sales pipeline
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">{message}</p>
        <button
          type="button"
          className={`${insightGhostButtonClassName} mt-4 border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-outline))] text-[var(--admin-danger)]`}
          onClick={onRetry}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry connection
        </button>
      </div>
    </div>
  );
}

function ConversionMeter({ value }: { value: number | null }) {
  const width = value == null ? 0 : Math.min(Math.max(value, 0), 100);
  return (
    <div className="h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
      <div className="h-full bg-[var(--admin-primary)]" style={{ width: `${String(width)}%` }} />
    </div>
  );
}

function FunnelColumn({
  window,
  stages,
  dropoffs,
  showDeltas,
}: {
  window: InsightSalesPipelineWindow;
  stages: InsightSalesPipelineStage[];
  dropoffs: InsightSalesPipelineDropoff[];
  showDeltas: boolean;
}) {
  return (
    <section className={`${insightPanelClassName} p-6`} aria-label={window.label}>
      <div className="mb-6 flex items-center justify-between gap-3 border-b border-[var(--admin-border)] pb-4">
        <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{window.label}</h3>
        <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
          {window.conversionDisplay} conversion
        </span>
      </div>
      <div className="flex flex-col justify-center gap-3">
        {stages.map((stage, index) => {
          const width = barWidth(window, stage.key, index);
          const dropoff = dropoffs[index];
          const delta = showDeltas ? stage.deltaDisplay : null;
          return (
            <div key={stage.key}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                  {stageIcon(stage.key)}
                  {stage.label}
                </span>
                <span className="flex items-center gap-2 font-data text-sm text-[var(--admin-on-surface)]">
                  {countLabel(window, stage.key)}
                  {delta && delta !== "-" ? (
                    <span className={`lg:hidden ${deltaClass(delta)}`}>{delta}</span>
                  ) : null}
                </span>
              </div>
              <div className="h-8 overflow-hidden rounded bg-[var(--admin-surface-low)]">
                <div
                  className={`h-full rounded ${
                    window.empty
                      ? "border-2 border-dashed border-[var(--admin-outline)] bg-transparent"
                      : index === 2
                        ? "bg-[var(--admin-primary)]"
                        : index === 1
                          ? "bg-[color-mix(in_srgb,var(--admin-primary)_45%,var(--admin-surface))]"
                          : "bg-[color-mix(in_srgb,var(--admin-primary)_22%,var(--admin-surface-high))]"
                  }`}
                  style={{ width: `${String(width)}%` }}
                />
              </div>
              {dropoff ? (
                <p className="mt-1 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                  {window.empty
                    ? "-"
                    : `${formatInsightNumber(window.id === "30d" ? dropoff.recentCount : dropoff.allTimeCount)} did not continue (${window.id === "30d" ? dropoff.recentRateDisplay : dropoff.allTimeRateDisplay})`}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {window.empty ? (
        <p className="mt-6 text-center text-xs text-[var(--admin-on-surface-variant)]">
          No pipeline events recorded.
        </p>
      ) : null}
    </section>
  );
}

function CentreGutter({ stages }: { stages: InsightSalesPipelineStage[] }) {
  return (
    <div
      className="hidden flex-col justify-center gap-8 py-16 lg:flex"
      aria-label="Stage conversion difference"
    >
      {stages.map((stage) => (
        <div key={stage.key} className="flex h-[72px] items-center justify-center">
          <span className={`font-data text-xs ${deltaClass(stage.deltaDisplay)}`}>
            {stage.deltaDisplay}
          </span>
        </div>
      ))}
    </div>
  );
}

function LeakPanel({ board }: { board: InsightSalesPipelineBoard }) {
  const maxDrop = Math.max(
    ...board.dropoffs.map((row) => Math.max(row.allTimeCount, row.recentCount)),
    1,
  );
  return (
    <section className={`${insightPanelClassName} p-6`} aria-label="Where the pipeline leaks">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
          Where the pipeline leaks
        </h3>
        {board.leakCaption ? (
          <span className="inline-flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] px-2 py-1 text-xs text-[var(--admin-warning)]">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {board.leakCaption}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-5">
        {board.dropoffs.map((row) => {
          const allWidth = Math.max(
            (row.allTimeCount / maxDrop) * 100,
            row.allTimeCount > 0 ? 6 : 0,
          );
          const recentWidth = Math.max(
            (row.recentCount / maxDrop) * 100,
            row.recentCount > 0 ? 6 : 0,
          );
          return (
            <div key={row.id}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p className="text-sm text-[var(--admin-on-surface)]">{row.label}</p>
                <p className="font-data text-xs text-[var(--admin-on-surface-variant)]">
                  {board.empty
                    ? "-"
                    : `${formatInsightNumber(row.allTimeCount)} all time · ${formatInsightNumber(row.recentCount)} in 30d`}
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
                  <div
                    className="h-full rounded-full bg-[color-mix(in_srgb,var(--admin-warning)_70%,var(--admin-surface))]"
                    style={{ width: `${String(board.empty ? 0 : allWidth)}%` }}
                  />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
                  <div
                    className="h-full rounded-full bg-[var(--admin-warning)]"
                    style={{ width: `${String(board.empty ? 0 : recentWidth)}%` }}
                  />
                </div>
              </div>
              <p className="mt-1 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
                Drop-off {row.allTimeRateDisplay} all time, {row.recentRateDisplay} in 30 days.
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SalesInsightPipelineView({
  slug,
  sectionTitle,
  board,
  loading,
  error,
  onRefresh,
}: SalesInsightPipelineViewProps) {
  const [copied, setCopied] = useState(false);
  const csv = useMemo(() => (board ? pipelineCsv(board) : ""), [board]);

  const onCopy = () => {
    if (!csv) return;
    void copyText(csv).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    });
  };

  const toneIcon =
    board?.differenceTone === "up" ? (
      <ArrowUp className="h-6 w-6" aria-hidden="true" />
    ) : board?.differenceTone === "down" ? (
      <ArrowDown className="h-6 w-6" aria-hidden="true" />
    ) : (
      <Minus className="h-6 w-6" aria-hidden="true" />
    );

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
        <span className="font-medium text-[var(--admin-on-surface)]">Pipeline</span>
      </nav>

      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Link
              href={adminInsightHref(slug)}
              prefetch={false}
              className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              aria-label="Back to Sales Insight"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className={insightPageTitleClassName}>{board?.title ?? "Sales pipeline"}</h1>
          </div>
          <p className={insightPageDescClassName}>
            Visitors, diagnostics started, and enrolments. All time against the last 30 days.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!board}
            onClick={onCopy}
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy as CSV"}
          </button>
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!board}
            onClick={() => {
              if (!csv) return;
              downloadCsv("sales-pipeline.csv", csv);
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>
          <Link
            href={board?.enrollmentsHref ?? "/admin/reports/enrollments"}
            prefetch={false}
            className={insightPrimaryButtonClassName}
          >
            Open Reports
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}
      {loading && !board ? <PipelineSkeleton /> : null}

      {board ? (
        <>
          {board.empty ? (
            <div className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-sm text-[var(--admin-on-surface-variant)]">
              <Info
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
                aria-hidden="true"
              />
              <p>
                Pipeline stages come from analytics events. Review visibility and layout in{" "}
                <Link
                  href={board.settingsHref || adminInsightSettingsHref(slug)}
                  prefetch={false}
                  className="font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                >
                  Insights settings
                </Link>
                .
              </p>
            </div>
          ) : null}

          <section
            className="grid grid-cols-1 overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] md:grid-cols-12"
            aria-label="Conversion headline"
          >
            <div className="flex flex-col justify-between p-6 md:col-span-4">
              <div>
                <p className={insightKpiLabelClassName}>Conversion (all time)</p>
                <p className={insightKpiValueClassName}>{board.conversionAllDisplay}</p>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-xs text-[var(--admin-on-surface-variant)]">
                  {board.allTime.empty
                    ? "No pipeline events recorded."
                    : `${formatInsightNumber(board.allTime.enrolled)} enrolled of ${formatInsightNumber(board.allTime.visited)} visited`}
                </p>
                <ConversionMeter value={board.conversionAllPct} />
              </div>
            </div>
            <div className="flex flex-col justify-between border-t border-[var(--admin-border)] p-6 md:col-span-3 md:border-l md:border-t-0">
              <div>
                <p className={insightKpiLabelClassName}>Conversion (30d)</p>
                <p className={insightKpiValueClassName}>{board.conversion30dDisplay}</p>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-xs text-[var(--admin-on-surface-variant)]">
                  {board.recent.empty
                    ? "No pipeline events recorded."
                    : `${formatInsightNumber(board.visited30d)} visited, ${formatInsightNumber(board.enrolled30d)} enrolled`}
                </p>
                <ConversionMeter value={board.conversion30dPct} />
              </div>
            </div>
            <div className="flex flex-col items-center justify-center border-t border-[var(--admin-border)] p-6 text-center md:col-span-2 md:border-l md:border-t-0">
              <p className={`${insightKpiLabelClassName} mb-1`}>Difference</p>
              <div
                className={`flex items-center gap-1 font-data text-2xl font-medium ${
                  board.differenceTone === "up"
                    ? "text-[var(--admin-success)]"
                    : board.differenceTone === "down"
                      ? "text-[var(--admin-danger)]"
                      : "text-[var(--admin-on-surface-variant)]"
                }`}
              >
                {toneIcon}
                <span>{board.differenceDisplay}</span>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-4 border-t border-[var(--admin-border)] p-6 md:col-span-3 md:border-l md:border-t-0">
              <div>
                <p className={insightKpiLabelClassName}>Visited (30d)</p>
                <p className="font-data text-xl text-[var(--admin-on-surface)]">
                  {formatInsightNumber(board.visited30d)}
                </p>
              </div>
              <div className="h-px bg-[var(--admin-border)]" />
              <div>
                <p className={insightKpiLabelClassName}>Enrolled (30d)</p>
                <p className="font-data text-xl text-[var(--admin-on-surface)]">
                  {formatInsightNumber(board.enrolled30d)}
                </p>
              </div>
            </div>
          </section>

          {board.caption ? (
            <p className="text-center text-xs text-[var(--admin-on-surface-variant)]">
              {board.caption}
            </p>
          ) : null}

          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[1fr_auto_1fr]">
            <FunnelColumn
              window={board.allTime}
              stages={board.stages}
              dropoffs={board.dropoffs}
              showDeltas={false}
            />
            <CentreGutter stages={board.stages} />
            <FunnelColumn
              window={board.recent}
              stages={board.stages}
              dropoffs={board.dropoffs}
              showDeltas
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section className={insightPanelClassName} aria-label="Stage details">
              <div className="flex flex-col justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4 sm:flex-row sm:items-center">
                <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Stage details
                </h3>
                {board.leakCaption ? (
                  <span className="inline-flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] px-2 py-1 text-xs text-[var(--admin-warning)]">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    {board.leakCaption}
                  </span>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead>
                    <tr className="bg-[var(--admin-surface-low)]">
                      <th className={`${insightTableHeadClassName} px-4 py-3`}>Stage</th>
                      <th className={`${insightTableHeadClassName} px-4 py-3 text-right`}>
                        All-time count
                      </th>
                      <th className={`${insightTableHeadClassName} px-4 py-3 text-right`}>
                        All-time conv.
                      </th>
                      <th className={`${insightTableHeadClassName} px-4 py-3 text-right`}>
                        30-day count
                      </th>
                      <th className={`${insightTableHeadClassName} px-4 py-3 text-right`}>
                        30-day conv.
                      </th>
                      <th className={`${insightTableHeadClassName} px-4 py-3 text-right`}>
                        Difference
                      </th>
                      <th className={`${insightTableHeadClassName} w-10 px-2 py-3`}>
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.stages.map((stage) => (
                      <tr key={stage.key} className={`${insightTableRowClassName} group`}>
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                            {stageIcon(stage.key)}
                            {stage.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-data text-sm">
                          {formatInsightNumber(stage.allTimeCount)}
                        </td>
                        <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                          {stage.allTimeConvDisplay}
                        </td>
                        <td className="px-4 py-2 text-right font-data text-sm">
                          {formatInsightNumber(stage.recentCount)}
                        </td>
                        <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                          {stage.recentConvDisplay}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-data text-sm ${deltaClass(stage.deltaDisplay)}`}
                        >
                          {stage.deltaDisplay}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Link
                            href={stage.href}
                            prefetch={false}
                            className="inline-flex rounded p-1 text-[var(--admin-outline)] outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                            aria-label={`Open ${stage.label}`}
                          >
                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <LeakPanel board={board} />
          </div>

          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            {board.caveat} Refreshed {formatRelativeTime(board.generatedAt)}.
          </p>
        </>
      ) : null}
    </div>
  );
}
