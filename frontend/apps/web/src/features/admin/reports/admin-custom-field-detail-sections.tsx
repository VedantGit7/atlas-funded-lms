"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, FileText, Search, Settings2 } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { formatMoney } from "./admin-custom-field-roster-api";
import {
  BooleanDistribution,
  CopyKeyButton,
  CrossTabulationPanel,
  FieldValueCell,
  NumberDistribution,
  SelectDistribution,
  Shimmer,
  TextTopValues,
  fieldTypeMarker,
  filterInputClassName,
  labelClassName,
  learnerInitials,
  statusPillClass,
} from "./admin-custom-field-detail-shared";
import type { CustomFieldDetailView, CustomFieldDetailViewReady } from "./use-custom-field-detail";

/** The field's name, type and visibility, with its actions. */
export function CustomFieldDetailHeader({ view }: { view: CustomFieldDetailViewReady }) {
  const { busy, field, formatDateShort, handleClientCsvExport, learners, setActionsOpen } = view;
  return (
    <div className="flex flex-col justify-between gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:flex-row md:items-start md:p-6">
      <div className="min-w-0 space-y-2">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
          {field.label}
        </h1>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
            {field.key}
          </span>
          <CopyKeyButton value={field.key} />
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="rounded-sm bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
            {fieldTypeMarker(field.fieldType)}
          </span>
          <span
            className={[
              "inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase",
              statusPillClass(field.status),
            ].join(" ")}
          >
            {field.status}
          </span>
          <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            Created {formatDateShort(field.createdAt)}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          className={ghostButtonClassName}
          disabled={busy || learners.length === 0}
          onClick={() => {
            handleClientCsvExport(false);
          }}
        >
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </button>
        <Link href="/admin/custom-fields" className={ghostButtonClassName}>
          <Settings2 className="h-4 w-4" aria-hidden />
          Edit field
        </Link>
        <button
          type="button"
          className={primaryButtonClassName}
          onClick={() => {
            setActionsOpen((open) => !open);
          }}
        >
          Cohort actions
        </button>
      </div>
    </div>
  );
}

/** The open actions menu: export, message and the field's settings. */
export function CustomFieldActionsPanel({
  view,
}: {
  view: CustomFieldDetailView & { audienceCount: number };
}) {
  const {
    actionsOpen,
    audienceCount,
    busy,
    formatCount,
    groupTitle,
    handleCreateGroup,
    handleSendMessage,
    handleServerExport,
    messageBody,
    messageSubject,
    setGroupTitle,
    setMessageBody,
    setMessageSubject,
  } = view;
  return (
    <>
      {actionsOpen ? (
        <div className="grid gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--admin-on-surface)]">Send message</p>
            <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
              {audienceCount > 0 ? (
                <>
                  Will reach{" "}
                  <strong className="font-medium text-[var(--admin-on-surface)]">
                    {formatCount(audienceCount)}
                  </strong>{" "}
                  selected learner{audienceCount === 1 ? "" : "s"}.
                </>
              ) : (
                <>Select learners in the table below to message them.</>
              )}
            </p>
            <input
              className={filterInputClassName}
              placeholder="Subject"
              value={messageSubject}
              onChange={(event) => {
                setMessageSubject(event.target.value);
              }}
            />
            <textarea
              className={`${filterInputClassName} min-h-[80px] py-2`}
              placeholder="Message"
              value={messageBody}
              onChange={(event) => {
                setMessageBody(event.target.value);
              }}
            />
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={
                busy || audienceCount === 0 || !messageSubject.trim() || !messageBody.trim()
              }
              onClick={() => void handleSendMessage()}
            >
              Send message
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--admin-on-surface)]">Create group</p>
            <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
              {audienceCount > 0 ? (
                <>
                  Creates a batch from{" "}
                  <strong className="font-medium text-[var(--admin-on-surface)]">
                    {formatCount(audienceCount)}
                  </strong>{" "}
                  selected learners.
                </>
              ) : (
                <>Select learners in the table below to create a group.</>
              )}
            </p>
            <input
              className={filterInputClassName}
              placeholder="Group title"
              value={groupTitle}
              onChange={(event) => {
                setGroupTitle(event.target.value);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={busy || audienceCount === 0 || !groupTitle.trim()}
                onClick={() => void handleCreateGroup()}
              >
                Create group
              </button>
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={busy}
                onClick={() => void handleServerExport()}
              >
                <Download className="h-4 w-4" aria-hidden />
                Queue export
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Fill rate and response counts for the field. */
export function CustomFieldDetailFigures({ view }: { view: CustomFieldDetailViewReady }) {
  const { formatCount, formatPct, formatRelativeDate, setValueFilter, summary, valueFilter } = view;
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-5">
      <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4 md:col-span-2">
        <span className={labelClassName}>Coverage</span>
        <span className="font-mono text-[32px] leading-none font-medium tabular-nums text-[var(--admin-on-surface)]">
          {formatPct(summary.coveragePct)}
        </span>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
          <div
            className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, summary.coveragePct ?? 0))}%`,
            }}
          />
        </div>
        <span className="mt-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          {formatCount(summary.filledCount)} of {formatCount(summary.learnerCount)} learners
        </span>
      </div>

      <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
        <span className={labelClassName}>Distinct values</span>
        <span className="font-mono text-[32px] leading-none font-medium tabular-nums text-[var(--admin-on-surface)]">
          {formatCount(summary.distinctValueCount)}
        </span>
      </div>

      <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
        <span className={labelClassName}>Most common</span>
        {summary.mostCommonValue ? (
          <>
            <span className="truncate text-lg font-medium text-[var(--admin-on-surface)]">
              {summary.mostCommonValue}
            </span>
            <span className="mt-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              {formatPct(summary.mostCommonSharePct)}
            </span>
          </>
        ) : (
          <span className="text-sm text-[var(--admin-on-surface-variant)]">No values</span>
        )}
      </div>

      <div className="flex flex-col justify-between gap-2 bg-[var(--admin-surface)] p-4">
        <button
          type="button"
          className="group text-left"
          onClick={() => {
            setValueFilter(valueFilter === "missing" ? "" : "missing");
          }}
        >
          <span className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--admin-warning)]">
            Missing
          </span>
          <span className="font-mono text-[28px] leading-none font-medium tabular-nums text-[var(--admin-warning)] group-hover:underline">
            {formatCount(summary.missingCount)}
          </span>
        </button>
        <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          Last updated {formatRelativeDate(summary.lastUpdatedAt)}
        </span>
      </div>
    </div>
  );
}

/** How the field is answered: its distribution and cross-tabulation, or why it has none. */
export function CustomFieldUsage({ view }: { view: CustomFieldDetailViewReady }) {
  const {
    detail,
    field,
    fieldType,
    formatDateShort,
    selectedCompare,
    setCompareWith,
    setValueFilter,
    valueFilter,
  } = view;
  return (
    <>
      {detail.neverUsed ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
            <FileText className="h-10 w-10 opacity-60" strokeWidth={1.5} />
          </div>
          <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
            No learner has a value for this field yet
          </h2>
          <p className="mb-8 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
            Created {formatDateShort(field.createdAt)}. Values will appear here once learners fill
            this field in.
          </p>
          <Link href="/admin/custom-fields" className={ghostButtonClassName}>
            <Settings2 className="h-4 w-4" aria-hidden />
            Edit field
          </Link>
        </div>
      ) : (
        <>
          {fieldType === "select" && detail.select ? (
            <SelectDistribution
              data={detail.select}
              valueFilter={valueFilter}
              onFilterValue={(value) => {
                setValueFilter(value ?? "");
              }}
            />
          ) : null}
          {fieldType === "select" ? (
            <CrossTabulationPanel
              compareFields={detail.compareFields}
              compareWith={selectedCompare}
              onCompareChange={(value) => {
                setCompareWith(value);
              }}
              crossTab={detail.crossTab}
            />
          ) : null}
          {fieldType === "number" && detail.number ? (
            <NumberDistribution data={detail.number} />
          ) : null}
          {fieldType === "boolean" && detail.boolean ? (
            <BooleanDistribution data={detail.boolean} />
          ) : null}
          {(fieldType === "text" || fieldType === "date") && detail.text ? (
            <TextTopValues data={detail.text} />
          ) : null}
        </>
      )}
    </>
  );
}

/** The learners' answers: filters, table, selection and pager. */
export function CustomFieldDetailLearners({ view }: { view: CustomFieldDetailViewReady }) {
  const {
    allOnPageSelected,
    applyNumberRange,
    field,
    fieldType,
    formatCount,
    formatDateShort,
    formatRelativeDate,
    handleClientCsvExport,
    learners,
    loading,
    maxValueInput,
    minValueInput,
    pageInfo,
    searchId,
    searchInput,
    selectOptionValues,
    selectedIds,
    selectedLearners,
    setActionsOpen,
    setAppliedMaxValue,
    setAppliedMinValue,
    setDebouncedSearch,
    setMaxValueInput,
    setMinValueInput,
    setPage,
    setSearchInput,
    setSelectedIds,
    setValueFilter,
    toggleRowSelection,
    toggleSelectAllOnPage,
    valueFilter,
    viewer,
  } = view;
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 md:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor={searchId} className={labelClassName}>
              Search
            </label>
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
              <input
                id={searchId}
                className={`${filterInputClassName} pl-8`}
                placeholder="Name or email"
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                }}
              />
            </div>
          </div>

          {fieldType === "select" ? (
            <div className="w-full">
              <span className={labelClassName}>Value</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={[
                    "rounded-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                    !valueFilter
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]"
                      : "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-primary)]",
                  ].join(" ")}
                  onClick={() => {
                    setValueFilter("");
                  }}
                >
                  All
                </button>
                {selectOptionValues.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={[
                      "rounded-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                      valueFilter === value
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]"
                        : "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-primary)]",
                    ].join(" ")}
                    onClick={() => {
                      setValueFilter(valueFilter === value ? "" : value);
                    }}
                  >
                    {value}
                  </button>
                ))}
                <button
                  type="button"
                  className={[
                    "rounded-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                    valueFilter === "missing"
                      ? "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]"
                      : "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-warning)]",
                  ].join(" ")}
                  onClick={() => {
                    setValueFilter(valueFilter === "missing" ? "" : "missing");
                  }}
                >
                  No value
                </button>
              </div>
            </div>
          ) : null}

          {fieldType === "number" ? (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className={labelClassName} htmlFor="cf-detail-min">
                  Min
                </label>
                <input
                  id="cf-detail-min"
                  type="number"
                  className={`${filterInputClassName} w-28`}
                  value={minValueInput}
                  onChange={(event) => {
                    setMinValueInput(event.target.value);
                  }}
                />
              </div>
              <div>
                <label className={labelClassName} htmlFor="cf-detail-max">
                  Max
                </label>
                <input
                  id="cf-detail-max"
                  type="number"
                  className={`${filterInputClassName} w-28`}
                  value={maxValueInput}
                  onChange={(event) => {
                    setMaxValueInput(event.target.value);
                  }}
                />
              </div>
              <button type="button" className={ghostButtonClassName} onClick={applyNumberRange}>
                Apply
              </button>
            </div>
          ) : null}

          {fieldType === "boolean" ? (
            <div>
              <span className={labelClassName}>Value</span>
              <div className="inline-flex overflow-hidden rounded-sm border border-[var(--admin-outline)]">
                {[
                  { key: "", label: "All" },
                  { key: "true", label: "Yes" },
                  { key: "false", label: "No" },
                  { key: "missing", label: "No value" },
                ].map((option) => (
                  <button
                    key={option.key || "all"}
                    type="button"
                    className={[
                      "h-9 px-3 text-[12px] font-medium transition-colors",
                      valueFilter === option.key
                        ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                        : "bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                    ].join(" ")}
                    onClick={() => {
                      setValueFilter(option.key);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div className="sticky top-0 z-20 flex h-10 items-center justify-between border-b border-[color-mix(in_srgb,var(--admin-primary)_20%,var(--admin-border))] bg-[var(--admin-primary-container)] px-4">
          <span className="text-[13px] font-medium text-[var(--admin-primary)]">
            {formatCount(selectedIds.size)} learners selected
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="text-[13px] text-[var(--admin-primary)] hover:underline"
              onClick={() => {
                setActionsOpen(true);
              }}
            >
              Create group
            </button>
            <button
              type="button"
              className="text-[13px] text-[var(--admin-primary)] hover:underline"
              onClick={() => {
                setActionsOpen(true);
              }}
            >
              Message learners
            </button>
            <button
              type="button"
              className="text-[13px] text-[var(--admin-primary)] hover:underline"
              disabled={selectedLearners.length === 0}
              onClick={() => {
                handleClientCsvExport(true);
              }}
            >
              Export selection
            </button>
            <button
              type="button"
              className="text-[13px] text-[var(--admin-primary)] hover:underline"
              onClick={() => {
                setSelectedIds(new Set());
              }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative overflow-x-auto">
        {loading ? (
          <div className="p-4" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="mb-3 flex gap-4">
                <Shimmer className="h-4 w-4" />
                <Shimmer className="h-4 w-40" />
                <Shimmer className="h-4 w-24" />
                <Shimmer className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : learners.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
              No learners match these filters
            </h3>
            <p className="mb-6 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
              Adjust the search or value filter to find learners for this field.
            </p>
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={() => {
                setSearchInput("");
                setDebouncedSearch("");
                setValueFilter("");
                setMinValueInput("");
                setMaxValueInput("");
                setAppliedMinValue(undefined);
                setAppliedMaxValue(undefined);
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 cursor-pointer rounded-[3px] border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    aria-label="Select all on page"
                  />
                </th>
                <th className="px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  Learner
                </th>
                <th className="px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  {field.label}
                </th>
                <th className="px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  Enrolments
                </th>
                <th className="px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  Total spent
                </th>
                <th className="px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  Last active
                </th>
                <th className="px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  Signed up
                </th>
                <th className="px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {learners.map((row) => {
                const selected = selectedIds.has(row.membershipId);
                return (
                  <tr
                    key={row.membershipId}
                    className={[
                      "h-12 transition-colors hover:bg-[var(--admin-surface-high)]",
                      selected
                        ? "bg-[color-mix(in_srgb,var(--admin-primary)_5%,var(--admin-surface))]"
                        : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 cursor-pointer rounded-[3px] border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                        checked={selected}
                        onChange={() => {
                          toggleRowSelection(row.membershipId);
                        }}
                        aria-label={`Select ${row.learnerName || row.email || "learner"}`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
                          {learnerInitials(row)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                            {row.learnerName || "—"}
                          </div>
                          <div className="truncate font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {row.email || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <FieldValueCell value={row.fieldValue} fieldType={field.fieldType} />
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[13px] tabular-nums text-[var(--admin-on-surface)]">
                      {formatCount(row.enrollmentCount)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[13px] tabular-nums text-[var(--admin-on-surface)]">
                      {formatMoney(row.totalSpentCents, row.currency, viewer.locale)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="text-[13px] text-[var(--admin-on-surface)]">
                        {formatRelativeDate(row.lastActiveAt)}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                      {formatDateShort(row.signedUpAt)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={[
                          "inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase",
                          statusPillClass(row.status),
                        ].join(" ")}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pageInfo ? (
        <div className="flex h-12 items-center justify-between border-t border-[var(--admin-border)] px-4">
          <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
            {formatCount(pageInfo.totalCount)} learner
            {pageInfo.totalCount === 1 ? "" : "s"}
            {pageInfo.totalPages > 1
              ? ` · page ${formatCount(pageInfo.page)} of ${formatCount(pageInfo.totalPages)}`
              : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={ghostButtonClassName}
              disabled={!pageInfo.hasPreviousPage || loading}
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
              }}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Prev
            </button>
            <button
              type="button"
              className={ghostButtonClassName}
              disabled={!pageInfo.hasNextPage || loading}
              onClick={() => {
                setPage((current) => current + 1);
              }}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
