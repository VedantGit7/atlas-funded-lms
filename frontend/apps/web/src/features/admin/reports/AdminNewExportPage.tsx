"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, Download, Info, Loader2 } from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import {
  ModuleTabs,
  type NewExportPageProps,
  PipelineMini,
  formatCount,
  secondaryButtonClassName,
} from "./admin-new-export-shared";
import {
  ExportColumnsStep,
  ExportDeliveryStep,
  ExportFormatStep,
  ExportReportStep,
  ExportScopeStep,
  ExportSummaryRail,
} from "./admin-new-export-sections";
import { useNewExport } from "./use-new-export";

export function AdminNewExportPage(props: NewExportPageProps = {}) {
  const view = useNewExport(props);
  const {
    activeSection,
    canRun,
    delivery,
    error,
    format,
    handleCancelRun,
    handleDownload,
    handleRun,
    phase,
    preview,
    resetToNew,
    router,
    runBusy,
    runDetail,
    runId,
    sectionNav,
    selectedKey,
    setActiveSection,
  } = view;

  if (phase === "running" && runDetail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <ModuleTabs active="new" />
        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <div className="flex w-full max-w-3xl flex-col items-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center shadow-sm">
            <Loader2 className="mb-3 h-12 w-12 animate-spin text-[var(--admin-primary-strong)] motion-reduce:animate-none" />
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
              Exporting data
            </h1>
            <p className="mt-1 text-[12px] text-[var(--admin-on-surface-variant)]">
              Please wait while we prepare your export.
            </p>
            <div className="mt-8 w-full">
              <PipelineMini stages={runDetail.pipeline} />
            </div>
            <div className="mt-6 w-full max-w-md">
              <div className="mb-2 flex justify-between font-mono text-[13px]">
                <span className="text-[var(--admin-on-surface-variant)]">
                  {runDetail.rowCount != null
                    ? `${formatCount(runDetail.rowCount)} rows`
                    : "Working…"}
                  {" · "}
                  {runDetail.progressPercent == null
                    ? "…"
                    : `${String(runDetail.progressPercent)}%`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                <div
                  className="h-full rounded-full bg-[var(--admin-primary-strong)] transition-all duration-500"
                  style={{ width: `${String(runDetail.progressPercent ?? 8)}%` }}
                />
              </div>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                className="text-sm text-[var(--admin-danger)] hover:underline"
                onClick={() => void handleCancelRun()}
              >
                Cancel
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  router.push(`/admin/reports/exports/${runDetail.id}?source=report_run`);
                }}
              >
                Run in the background
              </button>
            </div>
          </div>
          <div className="mt-6 w-full max-w-md rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 text-left">
            <h3 className="mb-3 text-[12px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
              Parameters summary
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-[var(--admin-on-surface-variant)]">Report</span>
                <span className="font-mono text-[var(--admin-on-surface)]">
                  {runDetail.definitionKey ?? runDetail.definitionTitle}
                </span>
              </div>
              <div className="h-px bg-[var(--admin-border)]" />
              <div className="flex justify-between gap-4">
                <span className="text-[var(--admin-on-surface-variant)]">Filters</span>
                <span className="text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {runDetail.filterChips[0] ?? "None"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "succeeded" && runDetail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <ModuleTabs active="new" />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="flex w-full max-w-xl flex-col items-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center shadow-sm">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
              Export complete
            </h1>
            <span className="mt-3 inline-flex rounded border border-[color-mix(in_srgb,var(--admin-success)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] px-2 py-1 font-mono text-[11px] font-semibold tracking-wider text-[var(--admin-success)] uppercase">
              Succeeded
            </span>
            <div className="mt-8 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6 text-left">
              <p className="mb-1 text-[12px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                File name
              </p>
              <p className="truncate font-mono text-[13px] text-[var(--admin-on-surface)]">
                {runDetail.fileName}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--admin-border)] pt-4">
                <div>
                  <p className="text-[12px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Size
                  </p>
                  <p className="font-mono text-[13px]">{runDetail.estimatedSizeLabel ?? "-"}</p>
                </div>
                <div>
                  <p className="text-[12px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Rows
                  </p>
                  <p className="font-mono text-[13px]">
                    {runDetail.rowCount == null ? "-" : formatCount(runDetail.rowCount)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className={primaryButtonClassName}
                onClick={() => void handleDownload()}
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button type="button" className={secondaryButtonClassName} onClick={resetToNew}>
                New export
              </button>
              <Link
                href={`/admin/reports/exports/${runDetail.id}?source=report_run`}
                className={secondaryButtonClassName}
              >
                Open run
              </Link>
            </div>
            {runDetail.expiresAt ? (
              <p className="mt-6 flex items-center gap-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                <Info className="h-4 w-4" />
                File will be removed after {runDetail.expiresAt.slice(0, 10)}.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <ModuleTabs active="new" />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
            <div className="absolute top-0 right-0 left-0 h-1 bg-[var(--admin-danger)]" />
            <div className="flex flex-col gap-6 p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-[16px] font-semibold text-[var(--admin-on-surface)]">
                    Export failed
                  </h1>
                  <p className="mt-1 text-[12px] text-[var(--admin-on-surface-variant)]">
                    Review the error details and try again.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded border border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] px-2 py-1 font-mono text-[11px] font-semibold tracking-wider text-[var(--admin-danger)] uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-danger)]" />
                  Failed
                </span>
              </div>
              <div className="flex gap-4 rounded-md border border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" />
                <div>
                  <p className="font-mono text-[13px] font-semibold text-[var(--admin-danger)]">
                    {runDetail?.errorCode ?? "ExportFailed"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                    {runDetail?.errorMessage ??
                      error ??
                      "The export failed before a file was produced."}
                  </p>
                  {runDetail?.failureHint ? (
                    <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                      {runDetail.failureHint}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-[var(--admin-border)] pt-6">
                <div>
                  <p className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Run ID
                  </p>
                  <p className="font-mono text-[13px]">{runId ?? "-"}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Failure stage
                  </p>
                  <p className="font-mono text-[13px]">{runDetail?.failedStage ?? "-"}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-8 py-4">
              <button type="button" className={secondaryButtonClassName} onClick={resetToNew}>
                Retry with a narrower range
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={runBusy || !selectedKey}
                onClick={() => void handleRun()}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-28 lg:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            New export
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Build an export against any report, then download or schedule it.
          </p>
        </div>
        <Link href="/admin/reports/exports" className={secondaryButtonClassName}>
          Cancel
        </Link>
      </div>

      <ModuleTabs active="new" />

      {error ? (
        <div
          className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="flex gap-8">
        <nav className="sticky top-24 hidden w-44 shrink-0 flex-col gap-1 self-start xl:flex">
          {sectionNav.map((item) => (
            <a
              key={item.key}
              href={`#section-${item.key}`}
              onClick={() => {
                setActiveSection(item.key);
              }}
              className={`flex items-center gap-2 rounded-lg border-l-2 px-3 py-2 text-sm transition-colors ${
                activeSection === item.key
                  ? "border-[var(--admin-primary-strong)] bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]"
                  : "border-transparent text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-10 lg:flex-row lg:gap-8">
          <div className="flex min-w-0 max-w-[900px] flex-1 flex-col gap-10">
            {/* 1. Report */}
            <ExportReportStep view={view} />

            {/* 2. Scope */}
            <ExportScopeStep view={view} />

            {/* 3. Columns */}
            <ExportColumnsStep view={view} />

            {/* 4. Format */}
            <ExportFormatStep view={view} />

            {/* 5. Delivery */}
            <ExportDeliveryStep view={view} />
          </div>

          {/* Sticky summary rail */}
          <ExportSummaryRail view={view} />
        </div>
      </div>

      {/* Mobile sticky bar */}
      <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-lg lg:hidden">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3">
          <div className="min-w-0 flex-1 truncate text-[12px] text-[var(--admin-on-surface-variant)]">
            {preview ? formatCount(preview.estimatedRowCount) : "-"} rows · {format.toUpperCase()} ·{" "}
            {delivery}
          </div>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={!canRun}
            onClick={() => void handleRun()}
          >
            {runBusy ? "…" : "Run"}
          </button>
        </div>
      </div>
    </div>
  );
}
