"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Download,
  FormInput,
  HelpCircle,
  Info,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react";
import { ADMIN_INSIGHTS_HREF, adminInsightHref } from "./admin-insights-catalog";
import type {
  InsightMarketingCaptureBoard,
  InsightMarketingCaptureCtaRow,
  InsightMarketingCaptureFormRow,
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
  board: InsightMarketingCaptureBoard | null;
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

function captureCsv(board: InsightMarketingCaptureBoard): string {
  const lines = [
    ["Metric", "Value"].map(csvEscape).join(","),
    ["CTA click rate %", board.overallClickRatePct == null ? "-" : `${board.overallClickRatePct}%`]
      .map(csvEscape)
      .join(","),
    ["CTA views", board.ctaViews].map(csvEscape).join(","),
    ["CTA clicks", board.ctaClicks].map(csvEscape).join(","),
    ["Form submissions", board.submissionCount].map(csvEscape).join(","),
    ["Submissions (30d)", board.submissions30d].map(csvEscape).join(","),
    ["Contacts created", board.contactCount].map(csvEscape).join(","),
    "",
    ["Form", "Status", "Submissions", "Submissions (30d)", "Last submission"]
      .map(csvEscape)
      .join(","),
    ...board.forms.map((form) =>
      [
        form.title,
        form.status,
        form.submissions,
        form.submissions30d,
        form.lastSubmissionAt ?? "Never",
      ]
        .map(csvEscape)
        .join(","),
    ),
    "",
    ["CTA", "Type", "Status", "Views", "Clicks", "Click rate %"].map(csvEscape).join(","),
    ...board.ctas.map((cta) =>
      [
        cta.title,
        cta.ctaType,
        cta.status,
        cta.views,
        cta.clicks,
        cta.clickRatePct == null ? "-" : `${cta.clickRatePct}%`,
      ]
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

function CaptureSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading capture">
      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] md:grid-cols-12 md:divide-x md:divide-y-0">
          {Array.from({ length: 5 }).map((_, index) => (
            <section
              key={String(index)}
              className={`flex min-w-0 flex-col gap-2 p-5 md:p-6 ${index === 0 ? "md:col-span-4" : index < 4 ? "md:col-span-2" : "md:col-span-2"}`}
            >
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-8 w-20" />
              <Shimmer className="h-3 w-32" />
            </section>
          ))}
        </div>
      </div>
      <section className={`${insightPanelClassName} p-6`}>
        <Shimmer className="mb-4 h-4 w-40" />
        <Shimmer className="mb-6 h-24 w-full" />
        <Shimmer className="h-3 w-full max-w-2xl" />
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className={`${insightPanelClassName} p-5`}>
          <Shimmer className="mb-4 h-5 w-24" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Shimmer key={String(index)} className="mb-3 h-10 w-full" />
          ))}
        </section>
        <section className={`${insightPanelClassName} p-5`}>
          <Shimmer className="mb-4 h-5 w-24" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Shimmer key={String(index)} className="mb-3 h-10 w-full" />
          ))}
        </section>
      </div>
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

function WarningStrip({
  title,
  message,
  onDismiss,
}: {
  title: string;
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] p-4"
    >
      <TriangleAlert
        className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--admin-warning)]">{title}</p>
        <p className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">{message}</p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="rounded p-1 text-[var(--admin-warning)] opacity-70 outline-none transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--admin-warning)]/30"
          onClick={onDismiss}
          aria-label="Dismiss warning"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function formatConnectorRate(ratePct: number): string {
  const rounded = Math.round(ratePct * 10) / 10;
  if (rounded > 0) return `+${String(rounded)}%`;
  return `${String(rounded)}%`;
}

function ShareBar({ pct, tone }: { pct: number | null; tone?: "default" | "warning" }) {
  if (pct == null || pct <= 0) return null;
  const fill = tone === "warning" ? "bg-[var(--admin-warning)]" : "bg-[var(--admin-primary)]";
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

function CaptureChain({ board }: { board: InsightMarketingCaptureBoard }) {
  if (board.empty) {
    return (
      <section
        className={`${insightPanelClassName} flex flex-col items-center gap-4 px-6 py-12 text-center`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
          <FormInput
            className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
        </div>
        <div>
          <p className="text-base font-medium text-[var(--admin-on-surface)]">
            {board.emptyCaption}
          </p>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Create lead forms, landing pages, or CTAs to start collecting visitor information.
          </p>
        </div>
        <Link
          href={board.createFormHref}
          prefetch={false}
          className={insightPrimaryButtonClassName}
        >
          Create a form
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    );
  }

  return (
    <section className={`${insightPanelClassName} overflow-hidden`} aria-label="Capture chain">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4 md:px-6">
        <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">The Capture Chain</h2>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 py-1 text-[11px] text-[var(--admin-on-surface-variant)]">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          Views to Creation Flow
        </span>
      </header>

      <div className="p-5 md:p-6">
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 md:p-6">
          <div className="flex flex-col gap-6 lg:h-52 lg:flex-row lg:items-end lg:gap-2">
            {board.chain.steps.map((step, index) => {
              const next = board.chain.steps[index + 1];
              const barHeightPx = Math.max(
                Math.round((step.barSharePct / 100) * 160),
                step.count > 0 ? 10 : 4,
              );
              return (
                <div
                  key={step.id}
                  className="flex min-w-0 flex-1 flex-col gap-3 lg:h-full lg:flex-row lg:items-end lg:gap-2"
                >
                  <div className="group flex min-w-0 flex-1 flex-col items-center justify-end lg:h-full">
                    <p className="mb-2 font-data text-sm font-medium text-[var(--admin-on-surface)]">
                      {formatInsightNumber(step.count)}
                    </p>
                    <div
                      className={`w-full max-w-[120px] rounded-t-sm border transition-[filter] group-hover:brightness-110 ${
                        step.connectorIsLargestDrop
                          ? "border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-primary))]"
                          : index === 0
                            ? "border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-surface))]"
                            : "border-[var(--admin-primary)] bg-[var(--admin-primary)]"
                      }`}
                      style={{ height: `${String(barHeightPx)}px` }}
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-center text-xs font-medium text-[var(--admin-on-surface-variant)]">
                      {step.label}
                    </p>
                  </div>

                  {next && step.connectorRatePct != null ? (
                    <div className="relative flex w-full shrink-0 flex-row items-center justify-center gap-2 py-1 lg:h-full lg:w-16 lg:flex-col lg:pb-10">
                      <div
                        className={`hidden w-full border-t border-dashed lg:absolute lg:inset-x-0 lg:top-1/2 lg:block ${
                          step.connectorIsLargestDrop
                            ? "border-[var(--admin-warning)]"
                            : "border-[var(--admin-outline)]"
                        }`}
                        aria-hidden="true"
                      />
                      <div
                        className={`z-10 flex flex-col items-center rounded border px-2 py-1 font-data text-[10px] font-medium ${
                          step.connectorIsLargestDrop
                            ? "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
                            : step.connectorRatePct > 0
                              ? "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-success)]"
                              : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)]"
                        }`}
                      >
                        <span>{formatConnectorRate(step.connectorRatePct)}</span>
                        {step.connectorIsLargestDrop ? (
                          <ArrowDown className="h-3 w-3" aria-hidden="true" />
                        ) : null}
                      </div>
                      {step.connectorIsLargestDrop ? (
                        <span className="z-10 text-[10px] font-medium tracking-wide text-[var(--admin-warning)] lg:absolute lg:bottom-4 lg:whitespace-nowrap">
                          LARGEST DROP
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-xs leading-5 text-[var(--admin-on-surface-variant)]">
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p>{board.chain.caption}</p>
            {board.chain.dropCaption ? (
              <p className="mt-1 font-medium text-[var(--admin-warning)]">
                {board.chain.dropCaption}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function FormsTable({
  forms,
  caption,
  manageHref,
}: {
  forms: InsightMarketingCaptureFormRow[];
  caption: string;
  manageHref: string;
}) {
  return (
    <section className={`${insightPanelClassName} flex min-h-0 flex-col`} aria-label="Forms">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Forms</h2>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">{caption}</p>
        </div>
        <Link
          href={manageHref}
          prefetch={false}
          className="shrink-0 text-xs font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
        >
          View all
        </Link>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className={insightTableHeadClassName}>
            <tr>
              <th className="px-5 py-3 font-medium">Form</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Submissions</th>
              <th className="px-3 py-3 font-medium">30d</th>
              <th className="px-3 py-3 font-medium">Last submission</th>
              <th className="w-8 px-3 py-3" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {forms.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-8 text-center text-[var(--admin-on-surface-variant)]"
                >
                  No forms yet.
                </td>
              </tr>
            ) : (
              forms.map((form) => (
                <tr
                  key={form.id}
                  className={`${insightTableRowClassName} ${form.isDraft ? "opacity-60" : ""} ${
                    form.warningRail ? "border-l-4 border-l-[var(--admin-warning)]" : ""
                  }`}
                >
                  <td className="px-5 py-3">
                    <Link
                      href={form.href}
                      prefetch={false}
                      className="font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                    >
                      {form.title}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={form.status} />
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-data text-[var(--admin-on-surface)]">
                      {formatInsightNumber(form.submissions)}
                    </span>
                    <ShareBar pct={form.submissionSharePct} />
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`font-data ${
                        form.submissions30dWarning
                          ? "text-[var(--admin-warning)]"
                          : "text-[var(--admin-on-surface)]"
                      }`}
                    >
                      {formatInsightNumber(form.submissions30d)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {form.lastSubmissionAt ? (
                      <span
                        className="font-data text-[var(--admin-on-surface-variant)]"
                        title={form.lastSubmissionAt}
                      >
                        {formatRelativeTime(form.lastSubmissionAt)}
                      </span>
                    ) : (
                      <span className="font-data text-[var(--admin-warning)]">Never</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={form.href}
                      prefetch={false}
                      className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
                      aria-label={`Open ${form.title}`}
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

function CtasTable({
  ctas,
  manageHref,
}: {
  ctas: InsightMarketingCaptureCtaRow[];
  manageHref: string;
}) {
  return (
    <section className={`${insightPanelClassName} flex min-h-0 flex-col`} aria-label="CTAs">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">CTAs</h2>
        <Link
          href={manageHref}
          prefetch={false}
          className="shrink-0 text-xs font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
        >
          View all
        </Link>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className={insightTableHeadClassName}>
            <tr>
              <th className="px-5 py-3 font-medium">CTA</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Views</th>
              <th className="px-3 py-3 font-medium">Clicks</th>
              <th className="px-3 py-3 font-medium">Click rate</th>
              <th className="w-8 px-3 py-3" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {ctas.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-8 text-center text-[var(--admin-on-surface-variant)]"
                >
                  No CTAs yet.
                </td>
              </tr>
            ) : (
              ctas.map((cta) => (
                <tr key={cta.id} className={insightTableRowClassName}>
                  <td className="px-5 py-3">
                    <Link
                      href={cta.href}
                      prefetch={false}
                      className="font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                    >
                      {cta.title}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-data text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      {cta.ctaType}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={cta.status} />
                  </td>
                  <td className="px-3 py-3 font-data text-[var(--admin-on-surface)]">
                    {formatInsightNumber(cta.views)}
                  </td>
                  <td className="px-3 py-3 font-data text-[var(--admin-on-surface)]">
                    {formatInsightNumber(cta.clicks)}
                  </td>
                  <td className="px-3 py-3">
                    {cta.noViews ? (
                      <div>
                        <span className="font-data text-[var(--admin-on-surface-variant)]">-</span>
                        <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                          No views recorded
                        </p>
                      </div>
                    ) : (
                      <div>
                        <span
                          className={`font-data ${
                            cta.clickRateWarning
                              ? "text-[var(--admin-warning)]"
                              : "text-[var(--admin-on-surface)]"
                          }`}
                        >
                          {cta.clickRatePct == null ? "-" : `${cta.clickRatePct}%`}
                        </span>
                        <ShareBar
                          pct={cta.clickRatePct}
                          tone={cta.clickRateWarning ? "warning" : "default"}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={cta.href}
                      prefetch={false}
                      className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
                      aria-label={`Open ${cta.title}`}
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

function ClickRateByTypePanel({ board }: { board: InsightMarketingCaptureBoard }) {
  const maxRate = Math.max(
    ...board.clickRateByType.rows.map((row) => row.clickRatePct ?? 0),
    board.clickRateByType.overallRatePct ?? 0,
    1,
  );

  return (
    <section className={`${insightPanelClassName} p-5 md:p-6`} aria-label="Click rate by CTA type">
      <h2 className="mb-4 text-sm font-semibold text-[var(--admin-on-surface)]">
        Click rate by CTA type
      </h2>
      {board.clickRateByType.rows.length === 0 ? (
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          No CTA types to compare yet.
        </p>
      ) : (
        <div className="relative flex flex-col gap-4">
          {board.clickRateByType.overallRatePct != null ? (
            <div
              className="pointer-events-none absolute inset-y-0 border-l border-dashed border-[var(--admin-outline)]"
              style={{
                left: `${String(Math.min((board.clickRateByType.overallRatePct / maxRate) * 100, 100))}%`,
              }}
              aria-hidden="true"
            />
          ) : null}
          {board.clickRateByType.rows.map((row) => {
            const widthPct =
              row.clickRatePct == null
                ? 0
                : Math.max((row.clickRatePct / maxRate) * 100, row.clickRatePct > 0 ? 4 : 0);
            return (
              <div key={row.type} className={row.unstable ? "opacity-70" : undefined}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
                    {row.type}
                  </span>
                  <span className="font-data text-sm text-[var(--admin-on-surface)]">
                    {row.clickRatePct == null ? "-" : `${row.clickRatePct}%`}
                    <span className="ml-2 text-[var(--admin-on-surface-variant)]">
                      ({formatInsightNumber(row.views)} views)
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                  <div
                    className={`h-full rounded-full ${
                      row.unstable
                        ? "bg-[color-mix(in_srgb,var(--admin-primary)_45%,var(--admin-surface-high))]"
                        : "bg-[var(--admin-primary)]"
                    }`}
                    style={{ width: `${String(widthPct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {board.clickRateByType.caption ? (
        <p className="mt-4 text-xs leading-5 text-[var(--admin-on-surface-variant)]">
          {board.clickRateByType.caption}
        </p>
      ) : null}
    </section>
  );
}

export function MarketingInsightCaptureView({
  slug,
  sectionTitle,
  board,
  loading,
  error,
  onRefresh,
}: Props) {
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const csv = useMemo(() => (board ? captureCsv(board) : ""), [board]);

  useEffect(() => {
    setWarningDismissed(false);
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

  const clickRateDisplay =
    board?.overallClickRatePct == null ? "-" : `${board.overallClickRatePct}%`;
  const clickRateBarWidth =
    board?.overallClickRatePct == null ? 0 : Math.min(board.overallClickRatePct, 100);
  const clickRateWarning =
    board?.overallClickRatePct != null &&
    board.overallClickRatePct < board.clickRateWarnThreshold &&
    board.ctaViews >= 20;

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
        <span className="font-medium text-[var(--admin-on-surface)]">Capture</span>
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
            <h1 className={insightPageTitleClassName}>{board?.title ?? "Capture"}</h1>
          </div>
          <p className={insightPageDescClassName}>
            {board?.subtitle ?? "How forms and CTAs are performing, and where the drop happens."}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 xl:items-end">
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
                downloadCsv("marketing-capture.csv", csv);
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
            <Link
              href={board?.manageFormsHref ?? "/admin/marketing/forms"}
              prefetch={false}
              className={insightPrimaryButtonClassName}
            >
              Manage forms and CTAs
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}
      {loading && !board ? <CaptureSkeleton /> : null}

      {board ? (
        <>
          {board.zeroSubmissionWarning &&
          board.warningTitle &&
          board.warningMessage &&
          !warningDismissed ? (
            <WarningStrip
              title={board.warningTitle}
              message={board.warningMessage}
              onDismiss={() => {
                setWarningDismissed(true);
              }}
            />
          ) : null}

          <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] md:grid-cols-12 md:divide-x md:divide-y-0">
              <section
                className={`flex min-w-0 flex-col justify-between gap-2 p-5 md:col-span-4 md:p-6 ${
                  clickRateWarning
                    ? "bg-[color-mix(in_srgb,var(--admin-warning)_6%,var(--admin-surface))]"
                    : ""
                }`}
              >
                <span className={insightKpiLabelClassName}>CTA click rate</span>
                <div
                  className={`${insightKpiValueClassName} break-all ${
                    clickRateWarning ? "text-[var(--admin-warning)]" : ""
                  }`}
                >
                  {clickRateDisplay}
                </div>
                <ShareBar pct={clickRateBarWidth} tone={clickRateWarning ? "warning" : "default"} />
                <p className="text-[12px] leading-4 text-[var(--admin-on-surface-variant)]">
                  {formatInsightNumber(board.ctaClicks)} clicks of{" "}
                  {formatInsightNumber(board.ctaViews)} views
                </p>
              </section>
              <section
                className={`relative flex min-w-0 flex-col justify-between gap-2 p-5 md:col-span-2 md:p-6 ${
                  board.submissions30dWarning
                    ? "bg-[color-mix(in_srgb,var(--admin-warning)_6%,var(--admin-surface))]"
                    : ""
                }`}
              >
                {board.submissions30dWarning ? (
                  <span
                    className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-[var(--admin-warning)]"
                    aria-hidden="true"
                  />
                ) : null}
                <span className={insightKpiLabelClassName}>Form submissions</span>
                <div className={`${insightKpiValueClassName} break-all`}>
                  {formatInsightNumber(board.submissionCount)}
                </div>
                <p
                  className={`flex items-center gap-1 text-[12px] leading-4 ${
                    board.submissions30dWarning
                      ? "text-[var(--admin-warning)]"
                      : "text-[var(--admin-on-surface-variant)]"
                  }`}
                >
                  {board.submissions30dWarning ? (
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : null}
                  {formatInsightNumber(board.submissions30d)} in the last 30 days
                </p>
              </section>
              <section className="flex min-w-0 flex-col justify-between gap-2 p-5 md:col-span-2 md:p-6">
                <span className={insightKpiLabelClassName}>Live forms</span>
                <div className={`${insightKpiValueClassName} break-all`}>
                  {formatInsightNumber(board.liveFormCount)}
                  <span className="ml-1 text-base font-normal text-[var(--admin-on-surface-variant)]">
                    of {formatInsightNumber(board.formCount)}
                  </span>
                </div>
              </section>
              <section className="flex min-w-0 flex-col justify-between gap-2 p-5 md:col-span-2 md:p-6">
                <span className={insightKpiLabelClassName}>Live CTAs</span>
                <div className={`${insightKpiValueClassName} break-all`}>
                  {formatInsightNumber(board.liveCtaCount)}
                  <span className="ml-1 text-base font-normal text-[var(--admin-on-surface-variant)]">
                    of {formatInsightNumber(board.ctaCount)}
                  </span>
                </div>
              </section>
              <section className="flex min-w-0 flex-col justify-between gap-2 p-5 md:col-span-2 md:p-6">
                <span className={insightKpiLabelClassName}>Contacts created</span>
                <div className={`${insightKpiValueClassName} break-all`}>
                  {formatInsightNumber(board.contactCount)}
                </div>
              </section>
            </div>
          </div>

          <CaptureChain board={board} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <FormsTable
              forms={board.forms}
              caption={board.formsCaption}
              manageHref={board.manageFormsHref}
            />
            <CtasTable ctas={board.ctas} manageHref={board.manageCtasHref} />
          </div>

          {!board.empty ? <ClickRateByTypePanel board={board} /> : null}
        </>
      ) : null}
    </div>
  );
}
