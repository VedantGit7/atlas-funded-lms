"use client";

import Link from "next/link";
import { Calendar, Check, ChevronDown, Loader2, Play, Search, X } from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import {
  DropdownField,
  dropdownItemClassName,
  inlineExpandClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { PII_DEFINITION_KEYS } from "./admin-exports-roster-api";
import {
  SectionHeader,
  fieldClassName,
  formatCount,
  isPiiColumn,
  secondaryButtonClassName,
} from "./admin-new-export-shared";
import type { NewExportView } from "./use-new-export";

/** Step 1: which report to export. */
export function ExportReportStep({ view }: { view: NewExportView }) {
  const {
    groupedDefinitions,
    loadingDefs,
    reportCollapsed,
    reportQuery,
    selectReport,
    selected,
    selectedKey,
    setActiveSection,
    setReportCollapsed,
    setReportQuery,
  } = view;
  return (
    <section id="section-report" className="scroll-mt-24">
      <SectionHeader
        step={1}
        title="Report"
        description="Choose which report this export should pull from."
      />
      {reportCollapsed && selected ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                {selected.name}
              </span>
              <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                {selected.key}
              </span>
              {PII_DEFINITION_KEYS.has(selected.key) ? (
                <span className="rounded border border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--admin-warning)]">
                  PII
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[12px] text-[var(--admin-on-surface-variant)]">
              {selected.description}
            </p>
          </div>
          <button
            type="button"
            className="text-sm font-medium text-[var(--admin-primary-strong)] hover:underline"
            onClick={() => {
              setReportCollapsed(false);
              setActiveSection("report");
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex items-center gap-2 border-b border-[var(--admin-border)] px-3 py-2">
            <Search className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
            <input
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-[var(--admin-on-surface-variant)]"
              placeholder="Search reports…"
              value={reportQuery}
              onChange={(event) => {
                setReportQuery(event.target.value);
              }}
            />
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {loadingDefs ? (
              <p className="p-4 text-sm text-[var(--admin-on-surface-variant)]">
                Loading definitions…
              </p>
            ) : groupedDefinitions.length === 0 ? (
              <p className="p-4 text-sm text-[var(--admin-on-surface-variant)]">
                No reports match your search.
              </p>
            ) : (
              groupedDefinitions.map((group) => (
                <div key={group.theme}>
                  <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2 text-[11px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    {group.theme}
                  </div>
                  {group.items.map((definition) => {
                    const active = definition.key === selectedKey;
                    return (
                      <button
                        key={definition.id}
                        type="button"
                        className={`flex w-full items-center gap-3 border-b border-[var(--admin-border)] border-l-2 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--admin-surface-high)] ${
                          active
                            ? "border-l-[var(--admin-primary-strong)] bg-[var(--admin-primary-container)]"
                            : "border-l-transparent"
                        }`}
                        onClick={() => {
                          selectReport(definition.key);
                        }}
                      >
                        <span className="w-[28%] shrink-0 text-sm font-medium text-[var(--admin-on-surface)]">
                          {definition.name}
                        </span>
                        <span className="w-[22%] shrink-0 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                          {definition.key}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--admin-on-surface-variant)]">
                          {definition.description || "No description"}
                        </span>
                        {PII_DEFINITION_KEYS.has(definition.key) ? (
                          <span className="shrink-0 rounded border border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--admin-warning)]">
                            PII
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Step 2: the date range and filters that scope the rows. */
export function ExportScopeStep({ view }: { view: NewExportView }) {
  const {
    addFilter,
    customFrom,
    customTo,
    dateLabelId,
    datePreset,
    datePresetOpen,
    draftField,
    draftOperator,
    draftValue,
    fieldLabelId,
    fieldOpen,
    filterableParams,
    filters,
    handlePreviewSample,
    operatorLabelId,
    operatorOpen,
    preview,
    previewBusy,
    previewOpen,
    rowLimit,
    selected,
    setCustomFrom,
    setCustomTo,
    setDatePreset,
    setDatePresetOpen,
    setDraftField,
    setDraftOperator,
    setDraftValue,
    setFieldOpen,
    setFilters,
    setOperatorOpen,
    setRowLimit,
  } = view;
  return (
    <section id="section-scope" className="scroll-mt-24">
      <SectionHeader
        step={2}
        title="Scope"
        description="Narrow the export with filters, a date range, and an optional row limit."
      />
      <div className="flex flex-col gap-5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
        {!selected ? (
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Select a report first.</p>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <label className="text-[12px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                Filters
              </label>
              <div className="flex flex-wrap gap-2">
                <div className="min-w-[150px] flex-1">
                  <DropdownField
                    label={<span className="sr-only">Field</span>}
                    labelId={fieldLabelId}
                    open={fieldOpen}
                    onToggle={() => {
                      setFieldOpen((o) => !o);
                    }}
                    triggerContent={
                      <span className="flex w-full items-center justify-between gap-2">
                        <span>
                          {filterableParams.find((p) => p.key === draftField)?.label ?? "Field"}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${fieldOpen ? "rotate-180" : ""}`}
                        />
                      </span>
                    }
                  >
                    <div className="max-h-56 overflow-y-auto p-1" role="listbox">
                      {filterableParams.map((param) => (
                        <button
                          key={param.key}
                          type="button"
                          role="option"
                          className={dropdownItemClassName}
                          onClick={() => {
                            setDraftField(param.key);
                            setFieldOpen(false);
                          }}
                        >
                          {param.label}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                </div>
                <div className="min-w-[120px]">
                  <DropdownField
                    label={<span className="sr-only">Operator</span>}
                    labelId={operatorLabelId}
                    open={operatorOpen}
                    onToggle={() => {
                      setOperatorOpen((o) => !o);
                    }}
                    triggerContent={
                      <span className="flex w-full items-center justify-between gap-2">
                        <span>{draftOperator === "eq" ? "is equal to" : "contains"}</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${operatorOpen ? "rotate-180" : ""}`}
                        />
                      </span>
                    }
                  >
                    <div className="p-1" role="listbox">
                      {(
                        [
                          ["eq", "is equal to"],
                          ["contains", "contains"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="option"
                          className={dropdownItemClassName}
                          onClick={() => {
                            setDraftOperator(value);
                            setOperatorOpen(false);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                </div>
                <input
                  className={`${fieldClassName} min-w-[140px] flex-1`}
                  value={draftValue}
                  onChange={(event) => {
                    setDraftValue(event.target.value);
                  }}
                  placeholder="Value"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addFilter();
                    }
                  }}
                />
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={addFilter}
                  aria-label="Add filter"
                >
                  Add
                </button>
              </div>
              {filters.length > 0 ? (
                <div className={`flex flex-wrap gap-2 ${inlineExpandClassName}`}>
                  {filters.map((filter) => (
                    <span
                      key={filter.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 py-1 text-[12px]"
                    >
                      <span className="text-[var(--admin-on-surface-variant)]">
                        {filter.field}:
                      </span>
                      <span className="font-medium text-[var(--admin-on-surface)]">
                        {filter.value}
                      </span>
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                        aria-label={`Remove ${filter.field} filter`}
                        onClick={() => {
                          setFilters((current) => current.filter((f) => f.id !== filter.id));
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-[12px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  Date range
                </label>
                <DropdownField
                  label={<span className="sr-only">Date range</span>}
                  labelId={dateLabelId}
                  open={datePresetOpen}
                  onToggle={() => {
                    setDatePresetOpen((o) => !o);
                  }}
                  leftIcon={<Calendar className="h-4 w-4" />}
                  triggerContent={
                    <span className="flex w-full items-center justify-between gap-2">
                      <span>
                        {datePreset === "7d"
                          ? "Last 7 days"
                          : datePreset === "90d"
                            ? "Last 90 days"
                            : datePreset === "custom"
                              ? "Custom"
                              : "Last 30 days"}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${datePresetOpen ? "rotate-180" : ""}`}
                      />
                    </span>
                  }
                >
                  <div className="p-1" role="listbox">
                    {(
                      [
                        ["7d", "Last 7 days"],
                        ["30d", "Last 30 days"],
                        ["90d", "Last 90 days"],
                        ["custom", "Custom"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="option"
                        className={dropdownItemClassName}
                        onClick={() => {
                          setDatePreset(value);
                          setDatePresetOpen(false);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </DropdownField>
                {datePreset === "custom" ? (
                  <div className={`mt-2 grid grid-cols-2 gap-2 ${inlineExpandClassName}`}>
                    <input
                      type="date"
                      className={fieldClassName}
                      value={customFrom}
                      onChange={(event) => {
                        setCustomFrom(event.target.value);
                      }}
                    />
                    <input
                      type="date"
                      className={fieldClassName}
                      value={customTo}
                      onChange={(event) => {
                        setCustomTo(event.target.value);
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[12px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  Row limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  className={fieldClassName}
                  placeholder="No limit (max 10,000)"
                  value={rowLimit}
                  onChange={(event) => {
                    setRowLimit(event.target.value);
                  }}
                />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-4">
              <p className="flex items-center gap-1.5 text-[12px] text-[var(--admin-on-surface-variant)]">
                {previewBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Check className="h-4 w-4 text-[var(--admin-success)]" />
                )}
                {preview
                  ? `About ${formatCount(preview.estimatedRowCount)} rows match current filters${preview.capped ? " (capped)" : ""}`
                  : "Estimating matching rows…"}
              </p>
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={previewBusy}
                onClick={() => void handlePreviewSample()}
              >
                Preview 10 rows
              </button>
            </div>

            {previewOpen && preview ? (
              <div
                className={`overflow-x-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] ${inlineExpandClassName}`}
              >
                <table className="w-full min-w-[480px] border-collapse text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                      {preview.columns.slice(0, 6).map((column) => (
                        <th
                          key={column}
                          className="px-3 py-2 font-mono font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sampleRows.map((row, index) => (
                      <tr
                        key={index}
                        className="border-b border-[var(--admin-border)] last:border-b-0"
                      >
                        {preview.columns.slice(0, 6).map((column) => (
                          <td
                            key={column}
                            className="max-w-[160px] truncate px-3 py-2 font-mono text-[var(--admin-on-surface)]"
                          >
                            {row[column] == null
                              ? "-"
                              : typeof row[column] === "string" ||
                                  typeof row[column] === "number" ||
                                  typeof row[column] === "boolean"
                                ? String(row[column])
                                : JSON.stringify(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/** Step 3: which columns, in what order. */
export function ExportColumnsStep({ view }: { view: NewExportView }) {
  const {
    availableColumns,
    emptyValuesMode,
    piiColumns,
    placeholderText,
    selected,
    selectedColumns,
    setEmptyValuesMode,
    setPlaceholderText,
    setSelectedColumns,
    toggleColumn,
  } = view;
  return (
    <section id="section-columns" className="scroll-mt-24">
      <SectionHeader
        step={3}
        title="Columns"
        description="Pick which fields appear in the file, and how empty values are written."
      />
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
        {!selected ? (
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Select a report first.</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                {selectedColumns.length} of {availableColumns.length || "…"} columns selected
              </p>
              <button
                type="button"
                className="text-sm font-medium text-[var(--admin-primary-strong)] hover:underline"
                onClick={() => {
                  setSelectedColumns(availableColumns);
                }}
              >
                Select all
              </button>
            </div>
            {piiColumns.length > 0 ? (
              <p className="mb-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,transparent)] px-3 py-2 text-[12px] text-[var(--admin-warning)]">
                {piiColumns.slice(0, 4).join(", ")}
                {piiColumns.length > 4 ? ", and more" : ""} are personal data.
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(availableColumns.length > 0 ? availableColumns : ["Loading…"]).map((column) => {
                const checked = selectedColumns.includes(column);
                const pii = isPiiColumn(column);
                return (
                  <label
                    key={column}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--admin-border)] px-3 py-2 hover:bg-[var(--admin-surface-low)]"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)]"
                      checked={checked}
                      disabled={availableColumns.length === 0}
                      onChange={() => {
                        toggleColumn(column);
                      }}
                    />
                    <span className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                      {column}
                    </span>
                    {pii ? (
                      <span className="ml-auto font-mono text-[10px] text-[var(--admin-warning)]">
                        PII
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
            <div className="mt-5 border-t border-[var(--admin-border)] pt-4">
              <p className="mb-2 text-[12px] font-semibold tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                Empty values
              </p>
              <div className="flex flex-wrap gap-4">
                {(
                  [
                    ["blank", "Leave blank"],
                    ["placeholder", "Write a placeholder"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="empty-values"
                      checked={emptyValuesMode === value}
                      onChange={() => {
                        setEmptyValuesMode(value);
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {emptyValuesMode === "placeholder" ? (
                <input
                  className={`${fieldClassName} mt-2 max-w-xs ${inlineExpandClassName}`}
                  value={placeholderText}
                  onChange={(event) => {
                    setPlaceholderText(event.target.value);
                  }}
                  placeholder="Placeholder text"
                />
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** Step 4: file format and options. */
export function ExportFormatStep({ view }: { view: NewExportView }) {
  const {
    csvDelimiter,
    csvEncoding,
    format,
    jsonShape,
    setCsvDelimiter,
    setCsvEncoding,
    setFormat,
    setJsonShape,
    setXlsxOneSheet,
    xlsxOneSheet,
  } = view;
  return (
    <section id="section-format" className="scroll-mt-24">
      <SectionHeader
        step={4}
        title="Format"
        description="Choose the file type and format-specific options."
      />
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
        <div className="inline-flex rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1">
          {(
            [
              ["csv", "CSV", "CSV for spreadsheets and imports"],
              ["xlsx", "XLSX", "XLSX keeps column types and formatting"],
              ["json", "JSON", "JSON for pipelines"],
            ] as const
          ).map(([value, label, caption]) => (
            <button
              key={value}
              type="button"
              title={caption}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                format === value
                  ? "bg-[var(--admin-surface)] text-[var(--admin-on-surface)] shadow-sm"
                  : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
              }`}
              onClick={() => {
                setFormat(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-[var(--admin-on-surface-variant)]">
          {format === "csv"
            ? "CSV for spreadsheets and imports"
            : format === "xlsx"
              ? "XLSX keeps column types and formatting"
              : "JSON for pipelines"}
        </p>
        {format === "csv" ? (
          <div className={`mt-4 grid grid-cols-2 gap-3 ${inlineExpandClassName}`}>
            <div>
              <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                Delimiter
              </label>
              <input
                className={fieldClassName}
                value={csvDelimiter}
                onChange={(event) => {
                  setCsvDelimiter(event.target.value.slice(0, 1) || ",");
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                Encoding
              </label>
              <input
                className={fieldClassName}
                value={csvEncoding}
                onChange={(event) => {
                  setCsvEncoding(event.target.value);
                }}
              />
            </div>
          </div>
        ) : null}
        {format === "xlsx" ? (
          <label className={`mt-4 flex items-center gap-2 text-sm ${inlineExpandClassName}`}>
            <input
              type="checkbox"
              checked={xlsxOneSheet}
              onChange={(event) => {
                setXlsxOneSheet(event.target.checked);
              }}
            />
            One sheet per group
          </label>
        ) : null}
        {format === "json" ? (
          <div className={`mt-4 flex flex-wrap gap-4 ${inlineExpandClassName}`}>
            {(
              [
                ["flat", "Flat"],
                ["nested", "Nested"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="json-shape"
                  checked={jsonShape === value}
                  onChange={() => {
                    setJsonShape(value);
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Step 5: download, email or a destination, now or on a schedule. */
export function ExportDeliveryStep({ view }: { view: NewExportView }) {
  const {
    cadenceLabelId,
    delivery,
    destinationLabelId,
    destinationOpen,
    destinations,
    destinationsLoading,
    scheduleCadence,
    scheduleCadenceOpen,
    scheduleEnabled,
    scheduleName,
    scheduleTimezone,
    selected,
    selectedDestination,
    setDelivery,
    setDestinationOpen,
    setScheduleCadence,
    setScheduleCadenceOpen,
    setScheduleEnabled,
    setScheduleName,
    setScheduleTimezone,
    setSelectedDestinationId,
  } = view;
  return (
    <section id="section-delivery" className="scroll-mt-24">
      <SectionHeader
        step={5}
        title="Delivery"
        description="Download when ready, email a link, or schedule a recurring run."
      />
      <div className="flex flex-col gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
        {(
          [
            ["download", "Download when ready"],
            ["email", "Email me when ready"],
            ["destination", "Send to a destination"],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
              delivery === value
                ? "border-[var(--admin-primary-strong)] bg-[var(--admin-primary-container)]"
                : "border-[var(--admin-border)]"
            }`}
          >
            <input
              type="radio"
              name="delivery"
              checked={delivery === value}
              onChange={() => {
                setDelivery(value);
              }}
            />
            {label}
          </label>
        ))}

        {delivery === "destination" ? (
          <div className={`space-y-2 ${inlineExpandClassName}`}>
            <label
              className="block text-[12px] text-[var(--admin-on-surface-variant)]"
              htmlFor={destinationLabelId}
            >
              Destination
            </label>
            <DropdownField
              label={<span className="sr-only">Destination</span>}
              labelId={destinationLabelId}
              open={destinationOpen}
              onToggle={() => {
                setDestinationOpen((o) => !o);
              }}
              triggerContent={
                <span className="flex w-full items-center justify-between gap-2">
                  {destinationsLoading
                    ? "Loading destinations…"
                    : selectedDestination
                      ? `${selectedDestination.name} (${selectedDestination.kind})`
                      : destinations.length === 0
                        ? "No destinations configured"
                        : "Select a destination"}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${destinationOpen ? "rotate-180" : ""}`}
                  />
                </span>
              }
            >
              <div className="max-h-56 overflow-y-auto p-1" role="listbox">
                {destinations.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    className={dropdownItemClassName}
                    onClick={() => {
                      setSelectedDestinationId(item.id);
                      setDestinationOpen(false);
                    }}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                      {item.kind}
                    </span>
                  </button>
                ))}
              </div>
            </DropdownField>
            {destinations.length === 0 && !destinationsLoading ? (
              <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
                Create one under{" "}
                <Link
                  href="/admin/reports/exports/destinations"
                  className="underline underline-offset-2"
                >
                  Destinations
                </Link>
                .
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-[var(--admin-border)] pt-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Schedule this export</span>
            <button
              type="button"
              role="switch"
              aria-checked={scheduleEnabled}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                scheduleEnabled ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]"
              }`}
              onClick={() => {
                setScheduleEnabled((current) => !current);
              }}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-[var(--admin-surface)] shadow transition-transform ${
                  scheduleEnabled ? "translate-x-4" : ""
                }`}
              />
            </button>
          </label>
          {scheduleEnabled ? (
            <div className={`mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 ${inlineExpandClassName}`}>
              <div>
                <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                  Cadence
                </label>
                <DropdownField
                  label={<span className="sr-only">Cadence</span>}
                  labelId={cadenceLabelId}
                  open={scheduleCadenceOpen}
                  onToggle={() => {
                    setScheduleCadenceOpen((o) => !o);
                  }}
                  triggerContent={
                    <span className="flex w-full items-center justify-between gap-2 capitalize">
                      {scheduleCadence}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${scheduleCadenceOpen ? "rotate-180" : ""}`}
                      />
                    </span>
                  }
                >
                  <div className="p-1" role="listbox">
                    {["hourly", "daily", "weekly", "monthly"].map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="option"
                        className={`${dropdownItemClassName} capitalize`}
                        onClick={() => {
                          setScheduleCadence(value);
                          setScheduleCadenceOpen(false);
                        }}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </DropdownField>
              </div>
              <div>
                <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                  Timezone
                </label>
                <input
                  className={fieldClassName}
                  value={scheduleTimezone}
                  onChange={(event) => {
                    setScheduleTimezone(event.target.value);
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                  Name this schedule
                </label>
                <input
                  className={fieldClassName}
                  value={scheduleName}
                  onChange={(event) => {
                    setScheduleName(event.target.value);
                  }}
                  placeholder={selected ? `${selected.name} schedule` : "Schedule name"}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** The sticky summary of the export being built, with its actions. */
export function ExportSummaryRail({ view }: { view: NewExportView }) {
  const {
    availableColumns,
    canRun,
    delivery,
    filterChips,
    format,
    handleRun,
    handleScheduleOnly,
    preview,
    runBusy,
    selected,
    selectedColumns,
    selectedKey,
    setScheduleEnabled,
  } = view;
  return (
    <aside className="hidden w-[300px] shrink-0 lg:block">
      <div className="sticky top-24 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
          <h3 className="text-[16px] font-bold text-[var(--admin-on-surface)]">
            Configuration summary
          </h3>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="border-b border-[var(--admin-border)] pb-3">
            <p className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
              Report
            </p>
            <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
              {selected?.name ?? "Not selected"}
            </p>
            {selected ? (
              <p className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                {selected.key}
              </p>
            ) : null}
          </div>
          <div className="border-b border-[var(--admin-border)] pb-3">
            <p className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
              Filters
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {filterChips.length === 0 ? (
                <span className="text-[12px] text-[var(--admin-on-surface-variant)]">None</span>
              ) : (
                filterChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded bg-[var(--admin-surface-high)] px-2 py-0.5 text-[12px] text-[var(--admin-on-surface-variant)]"
                  >
                    {chip}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--admin-border)] pb-3">
            <span className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
              Columns
            </span>
            <span className="font-mono text-[13px]">
              {selectedColumns.length}/{availableColumns.length || "-"}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--admin-border)] pb-3">
            <span className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
              Format
            </span>
            <span className="font-mono text-[13px] uppercase">{format}</span>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--admin-border)] pb-3">
            <span className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
              Delivery
            </span>
            <span className="text-[13px] capitalize">{delivery}</span>
          </div>
          <div className="flex items-center justify-between pb-1">
            <span className="font-mono text-[10px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
              Estimate
            </span>
            <span className="font-mono text-[13px]">
              {preview
                ? `${formatCount(preview.estimatedRowCount)} · ${preview.estimatedSizeLabel ?? "-"}`
                : "-"}
            </span>
          </div>
          <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
            Files are removed after 7 days.
          </p>
        </div>
        <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
          <button
            type="button"
            className={`${primaryButtonClassName} w-full`}
            disabled={!canRun}
            onClick={() => void handleRun()}
          >
            {runBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {runBusy ? "Starting…" : "Run export"}
          </button>
          <button
            type="button"
            className="mt-3 w-full text-center text-sm font-medium text-[var(--admin-primary-strong)] hover:underline disabled:opacity-40"
            disabled={!selectedKey || runBusy}
            onClick={() => {
              setScheduleEnabled(true);
              void handleScheduleOnly();
            }}
          >
            Save as a schedule only
          </button>
        </div>
      </div>
    </aside>
  );
}
