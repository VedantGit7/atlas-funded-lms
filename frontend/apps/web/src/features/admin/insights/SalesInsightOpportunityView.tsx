"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  Info,
  Mail,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { ADMIN_INSIGHTS_HREF, adminInsightHref } from "./admin-insights-catalog";
import type {
  InsightSalesOpportunityBoard,
  InsightSalesOpportunityMix,
  InsightSalesOpportunitySegment,
} from "./admin-insights-api";
import { csvEscape, formatInsightNumber } from "./admin-insights-format";
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
} from "./admin-insights-shared";

type SalesInsightOpportunityViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightSalesOpportunityBoard | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

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

function opportunityCsv(board: InsightSalesOpportunityBoard): string {
  const lines = [["Segment", "Count", "Share of enrollments"].map(csvEscape).join(",")];
  for (const row of board.segments) {
    lines.push(
      [row.label, row.count, row.sharePct == null ? "-" : `${row.sharePct}%`]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

function toneValueClass(tone: InsightSalesOpportunitySegment["tone"]): string {
  if (tone === "success") return "text-[var(--admin-success)]";
  if (tone === "warning") return "text-[var(--admin-warning)]";
  if (tone === "muted") return "text-[var(--admin-on-surface-variant)]";
  return "text-[var(--admin-on-surface)]";
}

function mixFill(id: string): string {
  if (id === "paid") return "var(--admin-primary)";
  if (id === "trial") return "var(--admin-warning)";
  if (id === "free") {
    return "color-mix(in srgb, var(--admin-warning) 55%, var(--admin-surface-high))";
  }
  return "var(--admin-outline)";
}

function ShareBar({ pct, fill }: { pct: number | null; fill?: string | undefined }) {
  const width = pct == null ? 0 : Math.min(Math.max(pct, 0), 100);
  return (
    <div className="h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
      <div
        className="h-full rounded-full bg-[var(--admin-primary)]"
        style={{ width: `${String(width)}%`, ...(fill ? { backgroundColor: fill } : {}) }}
      />
    </div>
  );
}

function Shimmer({ className, widthPct }: { className: string; widthPct?: number | undefined }) {
  return (
    <div
      className={`${insightShimmerClassName} ${className}`}
      style={widthPct != null ? { width: `${String(widthPct)}%` } : undefined}
    />
  );
}

function OpportunitySkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading conversion opportunity"
    >
      <div className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
        <Shimmer className="h-5 w-5 rounded-full" />
        <Shimmer className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 5 }, (_, index) => (
          <section
            key={index}
            className={`rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 ${index === 0 ? "sm:col-span-2" : ""}`}
          >
            <Shimmer className="mb-4 h-3 w-28" />
            <Shimmer className="mb-4 h-8 w-24" />
            <Shimmer className="h-3 w-32" />
          </section>
        ))}
      </div>
      {Array.from({ length: 5 }, (_, index) => (
        <section key={index} className={`${insightPanelClassName} p-6`}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <Shimmer className="mb-2 h-3 w-24" />
              <Shimmer className="mb-3 h-8 w-20" />
              <Shimmer className="h-[3px] w-full" />
            </div>
            <div className="lg:col-span-6">
              <Shimmer className="mb-2 h-4 w-full" />
              <Shimmer className="h-4 w-2/3" />
            </div>
            <div className="flex gap-2 lg:col-span-3 lg:justify-end">
              <Shimmer className="h-11 w-32" />
            </div>
          </div>
        </section>
      ))}
      <section className={`${insightPanelClassName} p-6`}>
        <Shimmer className="mb-4 h-5 w-32" />
        <Shimmer className="mb-4 h-8 w-full" />
        <Shimmer className="h-4 w-80" />
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
          Unable to load conversion opportunity
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

function HeadlineCell({
  label,
  value,
  caption,
  tone,
  sharePct,
  span,
}: {
  label: string;
  value: number;
  caption: string;
  tone: InsightSalesOpportunitySegment["tone"];
  sharePct?: number | null | undefined;
  span?: boolean | undefined;
}) {
  return (
    <section
      className={`flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 ${span ? "sm:col-span-2" : ""}`}
    >
      <span className={insightKpiLabelClassName}>{label}</span>
      <div className={`${insightKpiValueClassName} mt-2 ${toneValueClass(tone)}`}>
        {formatInsightNumber(value)}
      </div>
      <div className="mt-4 flex flex-col gap-1.5">
        <span className="text-[12px] text-[var(--admin-on-surface-variant)]">{caption}</span>
        {sharePct !== undefined ? (
          <ShareBar pct={sharePct} fill={tone === "warning" ? "var(--admin-warning)" : undefined} />
        ) : null}
      </div>
    </section>
  );
}

function SegmentBlock({ segment }: { segment: InsightSalesOpportunitySegment }) {
  if (segment.collapsed) {
    return (
      <section
        className="flex items-center justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
        aria-label={segment.label}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]">
            <Check className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">
            {segment.collapsedLabel ?? segment.label}
          </p>
        </div>
        <span className="font-data text-[12px] text-[var(--admin-on-surface-variant)]">
          0 pending
        </span>
      </section>
    );
  }

  return (
    <section className={`${insightPanelClassName} p-6`} aria-label={segment.label}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-3">
          <span className={insightKpiLabelClassName}>{segment.label}</span>
          <div className={`${insightKpiValueClassName} mt-2 ${toneValueClass(segment.tone)}`}>
            {formatInsightNumber(segment.count)}
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
              {segment.sharePct == null
                ? "No enrollments yet"
                : `${formatInsightNumber(segment.sharePct, 1)}% of enrollments`}
            </span>
            <ShareBar pct={segment.sharePct} fill={mixFill(segment.id)} />
          </div>
        </div>
        <div className="lg:col-span-6">
          <p className="text-sm text-[var(--admin-on-surface)]">{segment.body}</p>
          {segment.caption ? (
            <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
              {segment.caption}
            </p>
          ) : null}
          {segment.chips.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {segment.chips.map((chip) => (
                <span
                  key={chip.label}
                  className={`rounded border px-1.5 py-0.5 font-data text-[11px] font-medium ${
                    chip.tone === "warning"
                      ? "border-[color-mix(in_srgb,var(--admin-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] text-[var(--admin-warning)]"
                      : "border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]"
                  }`}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:col-span-3 lg:flex-col lg:items-stretch">
          {segment.primaryHref && segment.primaryLabel ? (
            <Link
              href={segment.primaryHref}
              prefetch={false}
              className={`${insightPrimaryButtonClassName} w-full`}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {segment.primaryLabel}
            </Link>
          ) : null}
          {segment.secondaryHref && segment.secondaryLabel ? (
            <Link
              href={segment.secondaryHref}
              prefetch={false}
              className={`${insightGhostButtonClassName} w-full`}
            >
              {segment.secondaryLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MixLegend({ row }: { row: InsightSalesOpportunityMix }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-sm"
          style={{ backgroundColor: mixFill(row.id) }}
          aria-hidden="true"
        />
        <span className="text-sm text-[var(--admin-on-surface-variant)]">{row.label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-data text-sm text-[var(--admin-on-surface)]">
          {row.sharePct == null ? "-" : `${formatInsightNumber(row.sharePct, 1)}%`}
        </span>
        <span className="w-12 text-right font-data text-[12px] text-[var(--admin-on-surface-variant)]">
          {formatInsightNumber(row.count)}
        </span>
      </div>
    </div>
  );
}

export function SalesInsightOpportunityView({
  slug,
  sectionTitle,
  board,
  loading,
  error,
  onRefresh,
}: SalesInsightOpportunityViewProps) {
  const [copied, setCopied] = useState(false);
  const csv = useMemo(() => (board ? opportunityCsv(board) : ""), [board]);

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
        <span className="font-medium text-[var(--admin-on-surface)]">Opportunity</span>
      </nav>

      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Link
              href={adminInsightHref(slug)}
              prefetch={false}
              className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              aria-label="Back to Sales Insight"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className={insightPageTitleClassName}>
              {board?.title ?? "Conversion opportunity"}
            </h1>
            {board?.allPaid ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] px-2 py-0.5 font-data text-[11px] font-medium text-[var(--admin-success)]">
                <Check className="h-3 w-3" aria-hidden="true" />
                All-paid
              </span>
            ) : null}
          </div>
          <p className={insightPageDescClassName}>
            Who is enrolled but not paying, and how they got there.
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
              downloadCsv("sales-opportunity.csv", csv);
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
      {loading && !board ? <OpportunitySkeleton /> : null}

      {board ? (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-sm text-[var(--admin-on-surface-variant)]">
            <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>
              <span className="font-medium text-[var(--admin-on-surface)]">Online</span> is a rollup
              of paid, free, and trial. These segments overlap and do not sum to the learner total.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-6">
            <HeadlineCell
              label="Trial + free pool"
              value={board.pool}
              caption="Learners enrolled without paying"
              tone="warning"
              sharePct={
                board.exclusiveTotal > 0
                  ? Math.round((board.pool / board.exclusiveTotal) * 1000) / 10
                  : null
              }
              span
            />
            <HeadlineCell
              label="Paid enrollments"
              value={board.paid}
              caption="Already converted"
              tone="success"
            />
            <HeadlineCell
              label="Trial"
              value={board.trial}
              caption="Highest-intent pool"
              tone="warning"
            />
            <HeadlineCell
              label="Free"
              value={board.free}
              caption="Largest unpaid pool"
              tone="warning"
            />
            <HeadlineCell
              label="Offline / manual"
              value={board.offline}
              caption="Granted outside checkout"
              tone="neutral"
            />
          </div>

          <div className="flex flex-col gap-6">
            {board.segments.map((segment) => (
              <SegmentBlock key={segment.id} segment={segment} />
            ))}
          </div>

          <section className={`${insightPanelClassName} p-6`} aria-label="Segment mix">
            <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
              Segment mix
            </h2>
            <div
              className="flex h-4 overflow-hidden rounded-full bg-[var(--admin-surface-high)]"
              role="img"
              aria-label="Paid, trial, and free mix"
            >
              {board.mix.map((row) => (
                <div
                  key={row.id}
                  className="h-full"
                  style={{
                    width: `${String(Math.max(row.sharePct ?? 0, row.count > 0 ? 2 : 0))}%`,
                    backgroundColor: mixFill(row.id),
                  }}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {board.mix.map((row) => (
                <MixLegend key={row.id} row={row} />
              ))}
            </div>
            <div className="mt-6 border-t border-dashed border-[var(--admin-border)] pt-4">
              <div className="mb-3 h-4 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                <div
                  className="h-full"
                  style={{
                    width: `${String(Math.max(board.offlineMix.sharePct ?? 0, board.offlineMix.count > 0 ? 2 : 0))}%`,
                    backgroundColor: mixFill("offline"),
                  }}
                />
              </div>
              <MixLegend row={board.offlineMix} />
              <p className="mt-3 text-[12px] text-[var(--admin-on-surface-variant)]">
                {board.mixCaption}
              </p>
            </div>
          </section>

          {board.allPaid ? (
            <div className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_24%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] p-5">
              <Info
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                  {board.caption}
                </p>
                <p className="mt-1 text-[12px] text-[var(--admin-on-surface-variant)]">
                  Paid and offline stay on this screen for scale. Offline is granted outside
                  checkout, not churned paid learners.
                </p>
              </div>
            </div>
          ) : null}

          {board.empty ? (
            <div className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <TriangleAlert
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                  {board.caption}
                </p>
                <p className="mt-1 text-[12px] text-[var(--admin-on-surface-variant)]">
                  Segments appear after the first enrollment is recorded.
                </p>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
