"use client";

import Link from "next/link";
import {
  ChevronRight,
  Columns3,
  Download,
  ExternalLink,
  FileText,
  MoreVertical,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { CUSTOM_FIELD_BASE_COLUMN_OPTIONS, formatMoney } from "./admin-custom-field-roster-api";
import {
  CustomFieldCell,
  type ExtraFilter,
  STATUS_OPTIONS,
  Shimmer,
  fieldTypeMarker,
  filterInputClassName,
  formatCount,
  formatDateShort,
  formatRelativeDate,
  labelClassName,
  learnerInitials,
  selectClassName,
  statusPillClass,
} from "./admin-custom-field-roster-shared";
import type { CustomFieldRosterView } from "./use-custom-field-roster";

/** The heading, date range, column picker and actions. */
export function CustomFieldRosterHeader({ view }: { view: CustomFieldRosterView }) {
  const {
    busy,
    columnSearch,
    columns,
    columnsOpen,
    columnsPanelId,
    fieldDefinitions,
    filteredColumnDefs,
    handleExport,
    loading,
    resetColumns,
    setActionsOpen,
    setColumnSearch,
    setColumns,
    setColumnsOpen,
    toggleColumn,
  } = view;
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
      <div className="max-w-2xl space-y-1">
        <nav
          className="mb-1 flex items-center gap-1.5 text-[12px] text-[var(--admin-on-surface-variant)]"
          aria-label="Breadcrumb"
        >
          <Link href="/admin" className="transition-colors hover:text-[var(--admin-primary)]">
            Admin
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <Link
            href="/admin/reports"
            className="transition-colors hover:text-[var(--admin-primary)]"
          >
            Reports
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span className="text-[var(--admin-on-surface)]">Custom Field</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
          Custom Field
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Every learner against the attributes your tenant defines - slice, group, message, or
          export by any of them.
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative">
          <button
            type="button"
            className={ghostButtonClassName}
            aria-expanded={columnsOpen}
            aria-controls={columnsPanelId}
            onClick={() => {
              setColumnsOpen((open) => !open);
            }}
          >
            <Columns3 className="h-4 w-4" aria-hidden />
            Columns
          </button>
          {columnsOpen ? (
            <div
              id={columnsPanelId}
              className="absolute right-0 z-40 mt-2 flex w-[320px] flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_12px_24px_-4px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]"
            >
              <div className="border-b border-[var(--admin-border)] p-3">
                <div className="relative">
                  <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
                  <input
                    className="h-8 w-full rounded-sm border-transparent bg-[var(--admin-surface-low)] pr-3 pl-8 text-[13px] text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)]/70 focus:border-[var(--admin-primary)] focus:bg-[var(--admin-surface)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    placeholder="Find column..."
                    value={columnSearch}
                    onChange={(event) => {
                      setColumnSearch(event.target.value);
                    }}
                  />
                </div>
              </div>
              <div className="flex max-h-[300px] flex-col gap-4 overflow-y-auto p-2">
                <div className="flex flex-col gap-1">
                  <span className="px-2 font-mono text-[11px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Learner columns
                  </span>
                  {CUSTOM_FIELD_BASE_COLUMN_OPTIONS.map((column) => (
                    <label
                      key={column.key}
                      className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-[var(--admin-surface-low)]"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded-[3px] border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                        checked={columns.includes(column.key)}
                        disabled={column.key === "learner_name"}
                        onChange={() => {
                          toggleColumn(column.key);
                        }}
                      />
                      <span className="flex-1 text-[13px] text-[var(--admin-on-surface)]">
                        {column.label}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between px-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Custom fields
                    </span>
                    <button
                      type="button"
                      className="text-[10px] text-[var(--admin-primary)] hover:underline"
                      onClick={() => {
                        setColumns((current) => {
                          const base = current.filter((c) => !c.startsWith("cf:"));
                          return [
                            ...base,
                            ...fieldDefinitions.map((definition) => `cf:${definition.key}`),
                          ];
                        });
                      }}
                    >
                      Select all
                    </button>
                  </div>
                  {filteredColumnDefs.length === 0 ? (
                    <p className="px-2 py-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                      No custom fields match.
                    </p>
                  ) : (
                    filteredColumnDefs.map((definition) => {
                      const key = `cf:${definition.key}`;
                      return (
                        <label
                          key={definition.id}
                          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-[var(--admin-surface-low)]"
                        >
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded-[3px] border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                            checked={columns.includes(key)}
                            onChange={() => {
                              toggleColumn(key);
                            }}
                          />
                          <span className="rounded-sm bg-[var(--admin-surface-high)] px-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                            {fieldTypeMarker(definition.fieldType)}
                          </span>
                          <span className="flex-1 text-[13px] text-[var(--admin-on-surface)]">
                            {definition.label}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                <button
                  type="button"
                  className="text-[12px] text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
                  onClick={resetColumns}
                >
                  Reset to default
                </button>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() => {
                    setColumnsOpen(false);
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
          className={ghostButtonClassName}
          disabled={busy || loading}
          onClick={() => void handleExport()}
        >
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </button>

        <Link href="/admin/custom-fields" className={ghostButtonClassName}>
          <Settings2 className="h-4 w-4" aria-hidden />
          Manage fields
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

/** The open actions menu: export and message. */
export function CustomFieldRosterActions({ view }: { view: CustomFieldRosterView }) {
  const {
    actionsOpen,
    busy,
    groupTitle,
    handleCreateGroup,
    handleSendMessage,
    messageBody,
    messageSubject,
    selectedIds,
    setGroupTitle,
    setMessageBody,
    setMessageSubject,
    totalCount,
    viewer,
  } = view;
  return (
    <>
      {actionsOpen ? (
        <div className="grid gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--admin-on-surface)]">Send message</p>
            <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
              Will reach{" "}
              <strong className="font-medium text-[var(--admin-on-surface)]">
                {selectedIds.size > 0
                  ? formatCount(selectedIds.size, viewer)
                  : formatCount(totalCount, viewer)}
              </strong>{" "}
              learner
              {selectedIds.size === 1 || (selectedIds.size === 0 && totalCount === 1) ? "" : "s"}
              {selectedIds.size > 0 ? " (selection)" : " matching filters"}.
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
              disabled={busy || !messageSubject.trim() || !messageBody.trim()}
              onClick={() => void handleSendMessage()}
            >
              Send message
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--admin-on-surface)]">Create group</p>
            <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
              Creates a batch from{" "}
              <strong className="font-medium text-[var(--admin-on-surface)]">
                {selectedIds.size > 0
                  ? formatCount(selectedIds.size, viewer)
                  : formatCount(totalCount, viewer)}
              </strong>{" "}
              matched learners.
            </p>
            <input
              className={filterInputClassName}
              placeholder="Group title"
              value={groupTitle}
              onChange={(event) => {
                setGroupTitle(event.target.value);
              }}
            />
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={busy || !groupTitle.trim()}
              onClick={() => void handleCreateGroup()}
            >
              Create group
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Search and the per-field filters, with the applied chips. */
export function CustomFieldRosterFilters({ view }: { view: CustomFieldRosterView }) {
  const {
    clearFilters,
    debouncedSearch,
    extraFilters,
    hasActiveFilters,
    searchId,
    searchInput,
    setDebouncedSearch,
    setExtraFilters,
    setPage,
    setSearchInput,
    setSignedUpFrom,
    setSignedUpTo,
    setStatus,
    signedUpFrom,
    signedUpTo,
    status,
    totalCount,
    viewer,
  } = view;
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={searchId} className={labelClassName}>
            Search
          </label>
          <div className="relative w-64 max-w-full">
            <Search className="absolute top-1/2 left-2.5 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
            <input
              id={searchId}
              className={`${filterInputClassName} pl-9`}
              placeholder="Name or email"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className={labelClassName}>Status</span>
          <Select
            className={selectClassName}
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClassName} htmlFor="cf-signed-from">
            Signed up from
          </label>
          <input
            id="cf-signed-from"
            type="date"
            className={`${filterInputClassName} w-40`}
            value={signedUpFrom}
            onChange={(event) => {
              setSignedUpFrom(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClassName} htmlFor="cf-signed-to">
            Signed up to
          </label>
          <input
            id="cf-signed-to"
            type="date"
            className={`${filterInputClassName} w-40`}
            value={signedUpTo}
            onChange={(event) => {
              setSignedUpTo(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className={`${labelClassName} text-transparent`}>Action</span>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-sm border border-dashed border-[var(--admin-outline)] px-3 text-[13px] text-[var(--admin-on-surface-variant)] transition-colors hover:border-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_5%,transparent)] hover:text-[var(--admin-primary)]"
            onClick={() => {
              setExtraFilters((current) => [
                ...current,
                { id: String(Date.now()), field: "email", value: "" },
              ]);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add field condition
          </button>
        </div>
      </div>

      {extraFilters.length > 0 ? (
        <div className="flex flex-col gap-2">
          {extraFilters.map((filter) => (
            <div key={filter.id} className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <span className={labelClassName}>Field</span>
                <select
                  className={filterInputClassName}
                  value={filter.field}
                  onChange={(event) => {
                    setExtraFilters((current) =>
                      current.map((item) =>
                        item.id === filter.id
                          ? {
                              ...item,
                              field: event.target.value as ExtraFilter["field"],
                              value: "",
                            }
                          : item,
                      ),
                    );
                  }}
                >
                  <option value="email">Email</option>
                  <option value="status">Status</option>
                  <option value="minTotalSpent">Min total spent</option>
                  <option value="maxTotalSpent">Max total spent</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className={labelClassName}>Value</span>
                <input
                  className={`${filterInputClassName} w-48`}
                  value={filter.value}
                  placeholder={
                    filter.field === "status"
                      ? "ACTIVE"
                      : filter.field.includes("Spent")
                        ? "Amount (e.g. 1000)"
                        : "Filter value"
                  }
                  onChange={(event) => {
                    setExtraFilters((current) =>
                      current.map((item) =>
                        item.id === filter.id ? { ...item, value: event.target.value } : item,
                      ),
                    );
                  }}
                />
              </div>
              <button
                type="button"
                className={ghostButtonClassName}
                onClick={() => {
                  setExtraFilters((current) => current.filter((item) => item.id !== filter.id));
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)] pt-3">
        <span className="mr-1 text-[12px] text-[var(--admin-on-surface-variant)]">
          Matches{" "}
          <strong className="font-medium text-[var(--admin-on-surface)]">
            {formatCount(totalCount, viewer)}
          </strong>{" "}
          learners
        </span>
        {debouncedSearch ? (
          <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-1 text-[12px]">
            <span className="text-[var(--admin-on-surface-variant)]">Search:</span>
            <span className="font-medium text-[var(--admin-on-surface)]">{debouncedSearch}</span>
            <button
              type="button"
              className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
              onClick={() => {
                setSearchInput("");
                setDebouncedSearch("");
              }}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : null}
        {status ? (
          <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-1 text-[12px]">
            <span className="text-[var(--admin-on-surface-variant)]">Status:</span>
            <span className="font-medium text-[var(--admin-on-surface)]">{status}</span>
            <button
              type="button"
              className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
              onClick={() => {
                setStatus("");
              }}
              aria-label="Clear status"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : null}
        {(signedUpFrom || signedUpTo) && (
          <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-1 text-[12px]">
            <span className="text-[var(--admin-on-surface-variant)]">Signed up:</span>
            <span className="font-medium text-[var(--admin-on-surface)]">
              {signedUpFrom || "…"} → {signedUpTo || "…"}
            </span>
            <button
              type="button"
              className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
              onClick={() => {
                setSignedUpFrom("");
                setSignedUpTo("");
              }}
              aria-label="Clear signed up range"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        {hasActiveFilters ? (
          <button
            type="button"
            className="ml-2 text-[12px] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)] hover:underline"
            onClick={clearFilters}
          >
            Clear all
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** The learner table with one column per field. */
export function CustomFieldRosterTable({ view }: { view: CustomFieldRosterView }) {
  const {
    allOnPageSelected,
    clearFilters,
    columns,
    fieldDefinitions,
    items,
    loading,
    rowMenuId,
    selectedIds,
    setRowMenuId,
    setSelectedMembershipId,
    sortBy,
    sortDir,
    toggleRowSelection,
    toggleSelectAllOnPage,
    toggleSort,
    viewer,
    visibleCustomKeys,
  } = view;
  return (
    <div className="relative flex-1 overflow-auto bg-[var(--admin-surface)]">
      {loading ? (
        <div className="p-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="mb-3 flex gap-4">
              <Shimmer className="h-4 w-4" />
              <Shimmer className="h-4 w-48" />
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-4 flex-1" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
            <FileText
              className="h-10 w-10 text-[var(--admin-on-surface-variant)]"
              strokeWidth={1.5}
            />
          </div>
          <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
            No learners match these filters
          </h3>
          <p className="mb-8 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
            Adjust or clear your current filter selections to view learners against your custom
            fields.
          </p>
          <button type="button" className={primaryButtonClassName} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="absolute top-0 bottom-0 left-0 z-30 w-0.5 bg-[var(--admin-primary)]" />
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-[0_1px_0_0_var(--admin-border)]">
              <tr>
                <th className="sticky left-0 z-20 w-10 border-r border-[color-mix(in_srgb,var(--admin-border)_30%,transparent)] bg-[var(--admin-surface-low)] px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 cursor-pointer rounded-[3px] border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    aria-label="Select all on page"
                  />
                </th>
                {columns.includes("learner_name") ? (
                  <th className="sticky left-10 z-20 w-64 cursor-pointer border-r border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase shadow-[4px_0_12px_color-mix(in_srgb,var(--admin-on-surface)_3%,transparent)] transition-colors hover:text-[var(--admin-on-surface)]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() => {
                        toggleSort("learner_name");
                      }}
                    >
                      Learner
                      {sortBy === "learner_name" ? (
                        <span className="text-[var(--admin-primary)]">
                          {sortDir === "asc" ? "↑" : "↓"}
                        </span>
                      ) : null}
                    </button>
                  </th>
                ) : null}
                {columns.includes("email") ? (
                  <th className="px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Email
                  </th>
                ) : null}
                {columns.includes("enrollment_count") ? (
                  <th className="cursor-pointer px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase transition-colors hover:text-[var(--admin-on-surface)]">
                    <button type="button" className="inline-flex w-full justify-end" disabled>
                      Enrolments
                    </button>
                  </th>
                ) : null}
                {columns.includes("total_spent_cents") ? (
                  <th className="cursor-pointer px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-end gap-1"
                      onClick={() => {
                        toggleSort("total_spent_cents");
                      }}
                    >
                      Total spent
                      {sortBy === "total_spent_cents" ? (
                        <span className="text-[var(--admin-primary)]">
                          {sortDir === "asc" ? "↑" : "↓"}
                        </span>
                      ) : null}
                    </button>
                  </th>
                ) : null}
                {columns.includes("last_active_at") ? (
                  <th className="cursor-pointer px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-end gap-1"
                      onClick={() => {
                        toggleSort("last_active_at");
                      }}
                    >
                      Last active on
                      {sortBy === "last_active_at" ? (
                        <span className="text-[var(--admin-primary)]">
                          {sortDir === "asc" ? "↑" : "↓"}
                        </span>
                      ) : null}
                    </button>
                  </th>
                ) : null}
                {columns.includes("signed_up_at") ? (
                  <th
                    className={[
                      "cursor-pointer px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] uppercase",
                      sortBy === "signed_up_at"
                        ? "bg-[color-mix(in_srgb,var(--admin-surface-low)_50%,transparent)] text-[var(--admin-primary)]"
                        : "text-[var(--admin-on-surface-variant)]",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-end gap-1"
                      onClick={() => {
                        toggleSort("signed_up_at");
                      }}
                    >
                      Signed up on
                      {sortBy === "signed_up_at" ? (
                        <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                      ) : null}
                    </button>
                  </th>
                ) : null}
                {columns.includes("status") ? (
                  <th className="px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Status
                  </th>
                ) : null}
                {visibleCustomKeys.map((key, index) => {
                  const definition = fieldDefinitions.find((item) => item.key === key);
                  return (
                    <th
                      key={key}
                      className={[
                        "whitespace-nowrap px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase",
                        index === 0
                          ? "border-l border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)]"
                          : "",
                      ].join(" ")}
                    >
                      <div className="flex flex-col items-start gap-0.5 normal-case tracking-normal">
                        <div className="flex items-center gap-2">
                          <span className="rounded-sm bg-[var(--admin-surface-high)] px-1 font-mono text-[10px] font-normal text-[var(--admin-on-surface-variant)]">
                            {fieldTypeMarker(definition?.fieldType ?? "text")}
                          </span>
                          <span className="font-sans text-[12px] font-semibold tracking-[0.06em] uppercase">
                            {definition?.label ?? key}
                          </span>
                        </div>
                        <span className="pl-7 font-mono text-[10px] font-normal tracking-normal text-[var(--admin-on-surface-variant)] normal-case">
                          {key}
                        </span>
                      </div>
                    </th>
                  );
                })}
                <th className="w-12 px-2 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)] text-[var(--admin-on-surface)]">
              {items.map((row) => {
                const selected = selectedIds.has(row.membershipId);
                return (
                  <tr
                    key={row.membershipId}
                    className={[
                      "group h-11 transition-colors",
                      selected
                        ? "bg-[var(--admin-primary-container)]"
                        : "hover:bg-[var(--admin-surface-high)]",
                    ].join(" ")}
                  >
                    <td
                      className={[
                        "sticky left-0 z-10 border-r border-[color-mix(in_srgb,var(--admin-border)_30%,transparent)] px-4",
                        selected
                          ? "bg-[var(--admin-primary-container)]"
                          : "bg-[var(--admin-surface)] group-hover:bg-[var(--admin-surface-high)]",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 cursor-pointer rounded-[3px] border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                        checked={selected}
                        onChange={() => {
                          toggleRowSelection(row.membershipId);
                        }}
                        aria-label={`Select ${row.email ?? row.learnerName ?? "learner"}`}
                      />
                    </td>
                    {columns.includes("learner_name") ? (
                      <td
                        className={[
                          "sticky left-10 z-10 max-w-[256px] border-r border-[var(--admin-border)] px-4 shadow-[4px_0_12px_color-mix(in_srgb,var(--admin-on-surface)_3%,transparent)]",
                          selected
                            ? "bg-[var(--admin-primary-container)]"
                            : "bg-[var(--admin-surface)] group-hover:bg-[var(--admin-surface-high)]",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 text-left"
                          onClick={() => {
                            setSelectedMembershipId(row.membershipId);
                          }}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-[10px] font-semibold text-[var(--admin-on-surface-variant)]">
                            {learnerInitials(row)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)]">
                              {row.learnerName ?? row.email ?? "—"}
                            </span>
                            {row.learnerName && row.email ? (
                              <span className="block truncate text-[12px] text-[var(--admin-on-surface-variant)]">
                                {row.email}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </td>
                    ) : null}
                    {columns.includes("email") ? (
                      <td className="max-w-[200px] truncate px-4 text-[13px]">
                        {row.email ? (
                          <button
                            type="button"
                            className="truncate text-left hover:text-[var(--admin-primary)] hover:underline"
                            onClick={() => {
                              setSelectedMembershipId(row.membershipId);
                            }}
                          >
                            {row.email}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    ) : null}
                    {columns.includes("enrollment_count") ? (
                      <td className="px-4 text-right font-mono text-[13px] tabular-nums">
                        {row.enrollmentCount}
                      </td>
                    ) : null}
                    {columns.includes("total_spent_cents") ? (
                      <td className="px-4 text-right font-mono text-[13px] tabular-nums text-[var(--admin-on-surface-variant)]">
                        {formatMoney(row.totalSpentCents, row.currency, viewer.locale)}
                      </td>
                    ) : null}
                    {columns.includes("last_active_at") ? (
                      <td className="px-4 text-right font-mono text-[13px] tabular-nums text-[var(--admin-on-surface-variant)]">
                        <span className="block">
                          {formatRelativeDate(row.lastActiveAt, viewer)}
                        </span>
                        {row.lastActiveAt ? (
                          <span className="block text-[11px] opacity-70">
                            {formatDateShort(row.lastActiveAt, viewer)}
                          </span>
                        ) : null}
                      </td>
                    ) : null}
                    {columns.includes("signed_up_at") ? (
                      <td className="px-4 text-right font-mono text-[13px] tabular-nums">
                        {formatDateShort(row.signedUpAt, viewer)}
                      </td>
                    ) : null}
                    {columns.includes("status") ? (
                      <td className="px-4">
                        <span
                          className={[
                            "inline-flex items-center justify-center rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase",
                            statusPillClass(row.status),
                          ].join(" ")}
                        >
                          {row.status}
                        </span>
                      </td>
                    ) : null}
                    {visibleCustomKeys.map((key, index) => {
                      const definition = fieldDefinitions.find((item) => item.key === key);
                      return (
                        <td
                          key={key}
                          className={[
                            "px-4",
                            index === 0
                              ? "border-l border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)]"
                              : "",
                          ].join(" ")}
                        >
                          <CustomFieldCell
                            value={row.customFields[key] ?? null}
                            fieldType={definition?.fieldType ?? "text"}
                          />
                        </td>
                      );
                    })}
                    <td className="relative px-2">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)]"
                        aria-label={`Actions for ${row.learnerName ?? row.email ?? "learner"}`}
                        aria-expanded={rowMenuId === row.membershipId}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setRowMenuId((current) =>
                            current === row.membershipId ? null : row.membershipId,
                          );
                        }}
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden />
                      </button>
                      {rowMenuId === row.membershipId ? (
                        <div
                          className="absolute right-2 z-30 mt-1 w-48 overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--admin-on-surface)_16%,transparent)]"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-low)]"
                            onClick={() => {
                              setRowMenuId(null);
                              setSelectedMembershipId(row.membershipId);
                            }}
                          >
                            View field values
                          </button>
                          <Link
                            href={`/admin/reports/custom-field/learners/${row.membershipId}`}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-low)]"
                            onClick={() => {
                              setRowMenuId(null);
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            Open full page
                          </Link>
                          <Link
                            href={`/admin/members/${row.membershipId}`}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-low)]"
                            onClick={() => {
                              setRowMenuId(null);
                            }}
                          >
                            Open member profile
                          </Link>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
