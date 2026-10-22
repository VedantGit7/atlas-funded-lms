"use client";

import Link from "next/link";
import {
  ArrowDown,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Inbox,
  Search,
  X,
} from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import {
  DropdownField,
  dropdownItemClassName,
  dropdownPanelSurfaceClassName,
  inlineExpandClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  EXPORTS_HISTORY_COLUMN_OPTIONS,
  EXPORTS_REPORT_DEFINITIONS,
  PII_DEFINITION_KEYS,
} from "./admin-exports-roster-api";
import {
  DEFAULT_COLUMNS,
  FileAffordance,
  StatusCell,
  fieldClassName,
  formatAbsolute,
  formatCount,
  formatRelative,
  isExpired,
  isExpiringSoon,
  secondaryButtonClassName,
  sourceLabel,
  statusLabel,
} from "./admin-exports-roster-shared";
import type { ExportsRosterView } from "./use-exports-roster";

/** The heading, module tabs and the actions for the run history. */
export function ExportsHeader({ view }: { view: ExportsRosterView }) {
  const {
    applyDatePreset,
    busy,
    columns,
    columnsAnchorRef,
    columnsOpen,
    columnsPanelRef,
    dateMenuOpen,
    datePreset,
    datePresetLabel,
    datePresetLabelId,
    draftColumns,
    handleExportHistory,
    loading,
    moduleTabs,
    setColumns,
    setColumnsOpen,
    setDateMenuOpen,
    setDraftColumns,
    setPage,
  } = view;
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-2xl">
        <p className="mb-1 text-xs font-medium tracking-wide text-[var(--admin-on-surface-variant)]">
          Admin / Reports / Exports
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
          Exports
        </h1>
        <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
          Every data extraction across all reports - what was pulled, by whom, and whether the file
          still exists.
        </p>
        <nav
          className="mt-4 flex items-end gap-5 border-b border-[var(--admin-border)]"
          aria-label="Exports module"
        >
          {moduleTabs.map((tab) => {
            const className = `-mb-px border-b-2 pb-2 text-sm transition-colors ${
              tab.key === "history"
                ? "border-[var(--admin-primary)] font-medium text-[var(--admin-primary)]"
                : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)] disabled:cursor-not-allowed disabled:opacity-50"
            }`;
            if (tab.href) {
              return (
                <Link key={tab.key} href={tab.href} className={className}>
                  {tab.label}
                </Link>
              );
            }
            return (
              <button
                key={tab.key}
                type="button"
                disabled={!tab.enabled}
                title={tab.enabled ? undefined : "Coming soon"}
                className={className}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[180px]">
          <DropdownField
            label={<span className="sr-only">Date range</span>}
            labelId={datePresetLabelId}
            open={dateMenuOpen}
            onToggle={() => {
              setDateMenuOpen((open) => !open);
            }}
            triggerContent={
              <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                <Calendar
                  className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <span className="flex-1 text-left">{datePresetLabel}</span>
              </span>
            }
            panelAriaLabel="Date range options"
          >
            <div className="p-1.5" role="listbox">
              {(
                [
                  ["7d", "Last 7 days"],
                  ["30d", "Last 30 days"],
                  ["90d", "Last 90 days"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="option"
                  aria-selected={datePreset === value}
                  className={dropdownItemClassName}
                  onClick={() => {
                    applyDatePreset(value);
                  }}
                >
                  {label}
                  {datePreset === value ? (
                    <Check className="ml-auto h-4 w-4" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>
          </DropdownField>
        </div>

        <div className="relative">
          <button
            ref={columnsAnchorRef}
            type="button"
            className={secondaryButtonClassName}
            aria-haspopup="dialog"
            aria-expanded={columnsOpen}
            onClick={() => {
              setDraftColumns(columns);
              setColumnsOpen((open) => !open);
            }}
          >
            <Columns3
              className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            Columns
            <ChevronDown
              className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${
                columnsOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>
          {columnsOpen ? (
            <div
              ref={columnsPanelRef}
              role="dialog"
              aria-label="Visible columns"
              className={`absolute right-0 top-[calc(100%+8px)] z-30 flex w-64 max-h-[80vh] flex-col overflow-hidden bg-[var(--admin-surface)] shadow-lg ${dropdownPanelSurfaceClassName}`}
            >
              <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                Visible columns
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto p-2">
                {EXPORTS_HISTORY_COLUMN_OPTIONS.map((option) => {
                  const checked = draftColumns.includes(option.key);
                  return (
                    <label
                      key={option.key}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[var(--admin-surface-low)] ${
                        checked
                          ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                          : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                        checked={checked}
                        onChange={() => {
                          setDraftColumns((current) => {
                            if (current.includes(option.key)) {
                              if (current.length === 1) return current;
                              return current.filter((column) => column !== option.key);
                            }
                            return [...current, option.key];
                          });
                        }}
                      />
                      <span className="text-sm text-[var(--admin-on-surface)]">{option.label}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-[var(--admin-border)] px-3 py-2">
                <button
                  type="button"
                  className="text-sm text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
                  onClick={() => {
                    setDraftColumns(DEFAULT_COLUMNS);
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() => {
                    setColumns(draftColumns);
                    setColumnsOpen(false);
                    setPage(1);
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={busy || loading}
          onClick={() => void handleExportHistory()}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {busy ? "Exporting…" : "Export this list"}
        </button>
        <Link href="/admin/reports/exports/new" className={primaryButtonClassName}>
          New export
        </Link>
      </div>
    </div>
  );
}

/** Counts of runs by state; each one filters the list. */
export function ExportsSummaryCards({ view }: { view: ExportsRosterView }) {
  const { applySavedView, datePresetLabel, successRate, summary, viewer } = view;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
      <div className="relative col-span-1 flex flex-col justify-between overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-2">
        <div className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-primary-strong)]" />
        <div>
          <p className="mb-1 text-[12px] tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
            Total exports
          </p>
          <div className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-on-surface)]">
            {formatCount(summary.totalCount, viewer)}
          </div>
        </div>
        <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
          in {datePresetLabel.toLowerCase()}
        </p>
      </div>

      <button
        type="button"
        className="col-span-1 flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:border-[color-mix(in_srgb,var(--admin-success)_50%,var(--admin-border))] active:translate-y-px"
        onClick={() => {
          applySavedView("all");
        }}
      >
        <div>
          <p className="mb-1 text-[12px] tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
            Succeeded
          </p>
          <div className="font-mono text-2xl font-medium text-[var(--admin-success)]">
            {formatCount(summary.succeededCount, viewer)}
          </div>
        </div>
        <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
          {successRate == null ? "No runs yet" : `${successRate}% success rate`}
        </p>
      </button>

      <button
        type="button"
        className="col-span-1 flex flex-col justify-between rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] active:translate-y-px"
        onClick={() => {
          applySavedView("failed");
        }}
      >
        <div>
          <p className="mb-1 text-[12px] tracking-wide text-[var(--admin-danger)] uppercase">
            Failed
          </p>
          <div className="font-mono text-2xl font-medium text-[var(--admin-danger)]">
            {formatCount(summary.failedCount, viewer)}
          </div>
        </div>
        <p className="mt-2 text-[12px] text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface-variant))]">
          {summary.failedCount > 0 ? "Needs review" : "None in range"}
        </p>
      </button>

      <button
        type="button"
        className="col-span-1 flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:border-[color-mix(in_srgb,var(--admin-warning)_50%,var(--admin-border))] active:translate-y-px"
        onClick={() => {
          applySavedView("running");
        }}
      >
        <div>
          <p className="mb-1 text-[12px] tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
            Queued / Running
          </p>
          <div className="font-mono text-2xl font-medium text-[var(--admin-warning)]">
            {formatCount(summary.pendingCount, viewer)}
          </div>
        </div>
        <p
          className="mt-2 truncate text-[12px] text-[var(--admin-on-surface-variant)]"
          title={summary.oldestPendingTitle ?? undefined}
        >
          {summary.oldestPendingTitle ? `Oldest: ${summary.oldestPendingTitle}` : "Queue is clear"}
        </p>
      </button>

      <button
        type="button"
        className="col-span-1 flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:border-[color-mix(in_srgb,var(--admin-warning)_50%,var(--admin-border))] active:translate-y-px"
        onClick={() => {
          applySavedView("expiring");
        }}
      >
        <div>
          <p className="mb-1 text-[12px] tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
            Files available
          </p>
          <div className="font-mono text-2xl font-medium text-[var(--admin-on-surface)]">
            {formatCount(summary.filesAvailableCount, viewer)}
          </div>
        </div>
        <p className="mt-2 text-[12px] text-[var(--admin-warning)]">
          {formatCount(summary.expiringSoonCount, viewer)} expiring in &lt; 48h
        </p>
      </button>
    </div>
  );
}

/** Search, status, report, format and date filters, with saved views and chips. */
export function ExportsFilters({ view }: { view: ExportsRosterView }) {
  const {
    appliedChips,
    applySavedView,
    clearAllFilters,
    definitionKey,
    fileLabelId,
    fileOpen,
    fileState,
    format,
    formatLabelId,
    formatOpen,
    pendingOnly,
    reportLabelId,
    reportOpen,
    savedView,
    savedViews,
    searchQ,
    setDefinitionKey,
    setFileOpen,
    setFileState,
    setFormat,
    setFormatOpen,
    setPage,
    setPendingOnly,
    setReportOpen,
    setSavedView,
    setSearchQ,
    setSourceOpen,
    setSourceType,
    setStatus,
    setStatusOpen,
    sourceLabelId,
    sourceOpen,
    sourceType,
    status,
    statusLabelId,
    statusOpen,
  } = view;
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[12px] tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
          Views:
        </span>
        {savedViews.map((view) => {
          const active = savedView === view.key;
          return (
            <button
              key={view.key}
              type="button"
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                active
                  ? "border-[var(--admin-primary)] bg-[var(--admin-surface)] font-medium text-[var(--admin-primary)]"
                  : "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface)]"
              }`}
              onClick={() => {
                applySavedView(view.key);
              }}
            >
              {view.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-[200px] flex-1 gap-1 text-[12px] text-[var(--admin-on-surface-variant)]">
          Search
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <input
              className={`${fieldClassName} pl-9`}
              value={searchQ}
              onChange={(event) => {
                setSearchQ(event.target.value);
                setPage(1);
              }}
              placeholder="Search file name, report, or requester"
            />
          </div>
        </label>

        <div className="min-w-[140px]">
          <DropdownField
            label={
              <span className="text-[12px] text-[var(--admin-on-surface-variant)]">Source</span>
            }
            labelId={sourceLabelId}
            open={sourceOpen}
            onToggle={() => {
              setSourceOpen((open) => !open);
            }}
            triggerContent={
              <span>
                {sourceType === "report_run"
                  ? "Report run"
                  : sourceType === "export_job"
                    ? "Export job"
                    : "All"}
              </span>
            }
            panelAriaLabel="Source filter"
          >
            <div className="p-1.5" role="listbox">
              {(
                [
                  ["", "All"],
                  ["report_run", "Report run"],
                  ["export_job", "Export job"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="option"
                  className={dropdownItemClassName}
                  onClick={() => {
                    setSourceType(value);
                    setSourceOpen(false);
                    setPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </DropdownField>
        </div>

        <div className="min-w-[140px]">
          <DropdownField
            label={
              <span className="text-[12px] text-[var(--admin-on-surface-variant)]">Status</span>
            }
            labelId={statusLabelId}
            open={statusOpen}
            onToggle={() => {
              setStatusOpen((open) => !open);
            }}
            triggerContent={
              <span>{pendingOnly ? "Queued / Running" : status ? statusLabel(status) : "All"}</span>
            }
            panelAriaLabel="Status filter"
          >
            <div className="p-1.5" role="listbox">
              {(
                [
                  ["", "All"],
                  ["QUEUED", "Queued"],
                  ["RUNNING", "Running"],
                  ["SUCCEEDED", "Succeeded"],
                  ["FAILED", "Failed"],
                  ["CANCELLED", "Cancelled"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="option"
                  className={dropdownItemClassName}
                  onClick={() => {
                    setStatus(value);
                    setPendingOnly(false);
                    setSavedView(value === "FAILED" ? "failed" : "all");
                    setStatusOpen(false);
                    setPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </DropdownField>
        </div>

        <div className="min-w-[200px]">
          <DropdownField
            label={
              <span className="text-[12px] text-[var(--admin-on-surface-variant)]">Report</span>
            }
            labelId={reportLabelId}
            open={reportOpen}
            onToggle={() => {
              setReportOpen((open) => !open);
            }}
            triggerContent={
              <span className="truncate">
                {definitionKey
                  ? (EXPORTS_REPORT_DEFINITIONS.find((entry) => entry.key === definitionKey)
                      ?.title ?? definitionKey)
                  : `Any (${EXPORTS_REPORT_DEFINITIONS.length} keys)`}
              </span>
            }
            panelAriaLabel="Report filter"
          >
            <div className="max-h-72 overflow-y-auto p-1.5" role="listbox">
              <button
                type="button"
                role="option"
                className={dropdownItemClassName}
                onClick={() => {
                  setDefinitionKey("");
                  setReportOpen(false);
                  setPage(1);
                }}
              >
                Any report
              </button>
              {EXPORTS_REPORT_DEFINITIONS.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  role="option"
                  className={dropdownItemClassName}
                  onClick={() => {
                    setDefinitionKey(entry.key);
                    setReportOpen(false);
                    setPage(1);
                  }}
                >
                  <span className="flex min-w-0 flex-col items-start">
                    <span>{entry.title}</span>
                    <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                      {entry.key}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </DropdownField>
        </div>

        <div className="min-w-[140px]">
          <DropdownField
            label={
              <span className="text-[12px] text-[var(--admin-on-surface-variant)]">Format</span>
            }
            labelId={formatLabelId}
            open={formatOpen}
            onToggle={() => {
              setFormatOpen((open) => !open);
            }}
            triggerContent={<span>{format ? format.toUpperCase() : "All formats"}</span>}
            panelAriaLabel="Format filter"
          >
            <div className="p-1.5" role="listbox">
              {(
                [
                  ["", "All formats"],
                  ["csv", "CSV"],
                  ["xlsx", "XLSX"],
                  ["pdf", "PDF"],
                  ["json", "JSON"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="option"
                  className={dropdownItemClassName}
                  onClick={() => {
                    setFormat(value);
                    setFormatOpen(false);
                    setPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </DropdownField>
        </div>

        <div className="min-w-[140px]">
          <DropdownField
            label={<span className="text-[12px] text-[var(--admin-on-surface-variant)]">File</span>}
            labelId={fileLabelId}
            open={fileOpen}
            onToggle={() => {
              setFileOpen((open) => !open);
            }}
            triggerContent={
              <span>
                {fileState === "available"
                  ? "Available"
                  : fileState === "removed"
                    ? "Removed"
                    : fileState === "expired"
                      ? "Expired"
                      : fileState === "expiring_soon"
                        ? "Expiring soon"
                        : "Any"}
              </span>
            }
            panelAriaLabel="File filter"
          >
            <div className="p-1.5" role="listbox">
              {(
                [
                  ["", "Any"],
                  ["available", "Available"],
                  ["removed", "Removed"],
                  ["expired", "Expired"],
                  ["expiring_soon", "Expiring soon"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="option"
                  className={dropdownItemClassName}
                  onClick={() => {
                    setFileState(value);
                    setSavedView(value === "expiring_soon" ? "expiring" : "all");
                    setFileOpen(false);
                    setPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </DropdownField>
        </div>
      </div>

      {appliedChips.length > 0 ? (
        <div className={`flex flex-wrap items-center gap-2 ${inlineExpandClassName}`}>
          {appliedChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 py-1 text-xs text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
              onClick={chip.clear}
            >
              {chip.label}
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            className="text-xs font-medium text-[var(--admin-primary)] transition-colors hover:text-[var(--admin-primary-strong)]"
            onClick={clearAllFilters}
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The run table, its row menus and the pager. */
export function ExportsTable({ view }: { view: ExportsRosterView }) {
  const {
    allVisibleSelected,
    clearAllFilters,
    downloadingId,
    handleDownload,
    items,
    page,
    selectedIds,
    setPage,
    show,
    showingFrom,
    showingTo,
    toggleAllVisible,
    toggleRow,
    totalCount,
    totalPages,
    viewer,
  } = view;
  return (
    <>
      {items.length === 0 ? (
        <section className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
          <Inbox
            className="mb-4 h-8 w-8 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
            No exports match these filters
          </h2>
          <p className="mb-6 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
            Try clearing filters or widening the date range.
          </p>
          <button type="button" className={secondaryButtonClassName} onClick={clearAllFilters}>
            Clear all filters
          </button>
        </section>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <th className="w-12 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Select all visible exports"
                    />
                  </th>
                  {show("status") ? (
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Status
                    </th>
                  ) : null}
                  {show("created_at") ? (
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      <span className="inline-flex items-center gap-1">
                        Created
                        <ArrowDown
                          className="h-4 w-4 text-[var(--admin-primary)]"
                          aria-hidden="true"
                        />
                      </span>
                    </th>
                  ) : null}
                  {show("source_type") ? (
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Source
                    </th>
                  ) : null}
                  {show("definition_title") || show("definition_key") ? (
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Report / Details
                    </th>
                  ) : null}
                  {show("row_count") ? (
                    <th className="px-4 py-3 text-right text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Rows
                    </th>
                  ) : null}
                  {show("format") ? (
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Format
                    </th>
                  ) : null}
                  {show("requested_by_name") ? (
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Requested by
                    </th>
                  ) : null}
                  {show("completed_at") ? (
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Completed
                    </th>
                  ) : null}
                  {show("expires_at") ? (
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Expires
                    </th>
                  ) : null}
                  {show("has_file") ? (
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Has file
                    </th>
                  ) : null}
                  <th className="px-4 py-3 text-right text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {items.map((item) => {
                  const selected = selectedIds.has(item.id);
                  const failed = item.status === "FAILED";
                  const containsPii =
                    item.definitionKey != null && PII_DEFINITION_KEYS.has(item.definitionKey);
                  const expired = isExpired(item.expiresAt, viewer.now);
                  const expiringSoon = isExpiringSoon(item.expiresAt, viewer.now);

                  return (
                    <tr
                      key={`${item.sourceType}-${item.id}`}
                      className={`group h-11 transition-colors hover:bg-[var(--admin-surface-high)] ${
                        selected
                          ? "relative bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                          : failed
                            ? "bg-[color-mix(in_srgb,var(--admin-danger)_5%,var(--admin-surface))]"
                            : ""
                      }`}
                    >
                      <td className="relative px-4 py-2 text-center">
                        {selected ? (
                          <span className="absolute top-0 bottom-0 left-0 w-0.5 bg-[var(--admin-primary-strong)]" />
                        ) : null}
                        <input
                          type="checkbox"
                          className={`h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] transition-opacity focus:ring-[var(--admin-primary)] ${
                            selected ? "opacity-100" : "opacity-50 group-hover:opacity-100"
                          }`}
                          checked={selected}
                          onChange={() => {
                            toggleRow(item.id);
                          }}
                          aria-label={`Select export ${item.definitionTitle ?? item.id}`}
                        />
                      </td>
                      {show("status") ? (
                        <td className="px-4 py-2">
                          <StatusCell item={item} />
                        </td>
                      ) : null}
                      {show("created_at") ? (
                        <td className="px-4 py-2 font-mono text-[13px] text-[var(--admin-on-surface)]">
                          <div>{formatRelative(item.createdAt, viewer)}</div>
                          <div className="text-[11px] text-[var(--admin-on-surface-variant)]">
                            {formatAbsolute(item.createdAt, viewer)}
                          </div>
                        </td>
                      ) : null}
                      {show("source_type") ? (
                        <td className="px-4 py-2">
                          <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-1.5 py-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                            {sourceLabel(item.sourceType)}
                          </span>
                        </td>
                      ) : null}
                      {show("definition_title") || show("definition_key") ? (
                        <td className="px-4 py-2">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {show("definition_title") ? (
                                <Link
                                  href={`/admin/reports/exports/${item.id}?source=${item.sourceType}`}
                                  className="text-sm font-medium text-[var(--admin-on-surface)] hover:text-[var(--admin-primary-strong)] hover:underline"
                                >
                                  {item.definitionTitle ?? "Definition no longer available"}
                                </Link>
                              ) : null}
                              {show("definition_key") && item.definitionKey ? (
                                <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                  {item.definitionKey}
                                </span>
                              ) : null}
                              {containsPii ? (
                                <span className="inline-flex items-center gap-0.5 rounded border border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[var(--admin-danger)] uppercase">
                                  PII
                                </span>
                              ) : null}
                            </div>
                            {failed && item.errorMessage ? (
                              <span
                                className="max-w-[240px] truncate font-mono text-xs text-[var(--admin-danger)]"
                                title={item.errorMessage}
                              >
                                {item.errorMessage}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                      {show("row_count") ? (
                        <td className="px-4 py-2 text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                          {item.rowCount == null ? "-" : formatCount(item.rowCount, viewer)}
                        </td>
                      ) : null}
                      {show("format") ? (
                        <td className="px-4 py-2 font-mono text-[13px] text-[var(--admin-on-surface)]">
                          {item.format?.toUpperCase() ?? "-"}
                        </td>
                      ) : null}
                      {show("requested_by_name") ? (
                        <td className="px-4 py-2 text-sm text-[var(--admin-on-surface)]">
                          {item.requestedByName ?? "-"}
                        </td>
                      ) : null}
                      {show("completed_at") ? (
                        <td className="px-4 py-2 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                          {formatAbsolute(item.completedAt, viewer)}
                        </td>
                      ) : null}
                      {show("expires_at") ? (
                        <td
                          className={`px-4 py-2 font-mono text-[13px] ${
                            expired
                              ? "text-[var(--admin-on-surface-variant)]"
                              : expiringSoon
                                ? "text-[var(--admin-warning)]"
                                : "text-[var(--admin-on-surface)]"
                          }`}
                        >
                          {expired ? "Expired" : formatAbsolute(item.expiresAt, viewer)}
                        </td>
                      ) : null}
                      {show("has_file") ? (
                        <td className="px-4 py-2 text-sm text-[var(--admin-on-surface-variant)]">
                          {item.hasFile ? "Yes" : "No"}
                        </td>
                      ) : null}
                      <td className="px-4 py-2 text-right">
                        <FileAffordance
                          item={item}
                          downloading={downloadingId === item.id}
                          onDownload={() => void handleDownload(item)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
            <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
              Showing {formatCount(showingFrom, viewer)}-{formatCount(showingTo, viewer)} of{" "}
              {formatCount(totalCount, viewer)} exports
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface)] disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
              <span className="px-2 font-mono text-[13px] text-[var(--admin-on-surface)]">
                {totalPages === 0 ? "0 / 0" : `${page} / ${totalPages}`}
              </span>
              <button
                type="button"
                className="rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface)] disabled:opacity-50"
                disabled={page >= totalPages || totalPages === 0}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
                aria-label="Next page"
              >
                <ChevronRight className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
