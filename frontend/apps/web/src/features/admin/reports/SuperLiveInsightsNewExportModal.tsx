"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { Calendar, ChevronDown, Info, Loader2, Search, X } from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  createSuperLiveInsightsExport,
  type CreateSliExportBody,
  type SliExportCadence,
  type SliExportColumn,
  type SliExportDataset,
  type SliExportDatePreset,
  type SliExportDelivery,
  type SliExportFormat,
  type SliExportGranularity,
  type SliExportHistoryItem,
  type SliExportScheduleItem,
  type SliExportScopeMode,
  type SliExportSeriesKind,
  type SuperLiveInsightsExportsPayload,
} from "./admin-super-live-insights-exports-api";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-10 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-outline)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]";

const DATASET_OPTIONS: Array<{
  value: SliExportDataset;
  label: string;
  description: string;
}> = [
  {
    value: "session_metrics",
    label: "Session metrics",
    description: "One row per session",
  },
  {
    value: "trend_series",
    label: "Trend series",
    description: "One row per period",
  },
  {
    value: "series_rollup",
    label: "Series rollup",
    description: "One row per course or batch",
  },
  {
    value: "outlier_findings",
    label: "Outlier findings",
    description: "One row per finding",
  },
];

const SESSION_DATA_COLUMNS: Array<{ value: SliExportColumn; label: string }> = [
  { value: "title", label: "Live class" },
  { value: "status", label: "Status" },
  { value: "course_title", label: "Course" },
  { value: "batch_name", label: "Batch" },
  { value: "scheduled_at", label: "Scheduled" },
  { value: "started_at", label: "Started" },
  { value: "ended_at", label: "Ended" },
  { value: "duration_seconds", label: "Duration" },
];

const METRICS_COLUMNS: Array<{ value: SliExportColumn; label: string }> = [
  { value: "attended_count", label: "Attended" },
  { value: "registered_count", label: "Registered" },
  { value: "absent_count", label: "Absent" },
  { value: "total_count", label: "Total" },
  { value: "avg_duration_seconds", label: "Avg duration" },
  { value: "attendance_rate", label: "Attendance %" },
];

const ALL_SESSION_COLUMNS: SliExportColumn[] = [
  ...SESSION_DATA_COLUMNS.map((item) => item.value),
  ...METRICS_COLUMNS.map((item) => item.value),
];

const DEFAULT_COLUMNS: SliExportColumn[] = [...ALL_SESSION_COLUMNS];

function PolicyToggle({
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

function formatEstimate(value: number | null): string {
  if (value == null) return "Row count varies";
  return `Produces ~${value.toLocaleString()} rows`;
}

export function SuperLiveInsightsNewExportModal({
  open,
  capabilities,
  estimates,
  initialScheduleEnabled,
  onClose,
  onCreated,
}: {
  open: boolean;
  capabilities: SuperLiveInsightsExportsPayload["capabilities"];
  estimates: SuperLiveInsightsExportsPayload["estimates"];
  initialScheduleEnabled: boolean;
  onClose: () => void;
  onCreated: (run: SliExportHistoryItem, schedule: SliExportScheduleItem | null) => void;
}) {
  const titleId = useId();
  const cadenceLabelId = useId();
  const datePresetLabelId = useId();
  const granularityLabelId = useId();
  const seriesKindLabelId = useId();

  const [dataset, setDataset] = useState<SliExportDataset>("session_metrics");
  const [format, setFormat] = useState<SliExportFormat>("csv");
  const [scopeMode, setScopeMode] = useState<SliExportScopeMode>("date_range");
  const [datePreset, setDatePreset] = useState<SliExportDatePreset>("30d");
  const [startedFrom, setStartedFrom] = useState("");
  const [startedTo, setStartedTo] = useState("");
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [columns, setColumns] = useState<SliExportColumn[]>(DEFAULT_COLUMNS);
  const [includeBenchmarks, setIncludeBenchmarks] = useState(true);
  const [granularity, setGranularity] = useState<SliExportGranularity>("week");
  const [seriesKind, setSeriesKind] = useState<SliExportSeriesKind>("course");
  const [delivery, setDelivery] = useState<SliExportDelivery>("download");
  const [recipientsText, setRecipientsText] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [cadence, setCadence] = useState<SliExportCadence>("weekly");
  const [time, setTime] = useState("07:00");
  const [timezone, setTimezone] = useState("UTC");
  const [cadenceOpen, setCadenceOpen] = useState(false);
  const [datePresetOpen, setDatePresetOpen] = useState(false);
  const [granularityOpen, setGranularityOpen] = useState(false);
  const [seriesKindOpen, setSeriesKindOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDataset("session_metrics");
    setFormat("csv");
    setScopeMode("date_range");
    setDatePreset("30d");
    setStartedFrom("");
    setStartedTo("");
    setCourseId("");
    setBatchId("");
    setSessionSearch("");
    setColumns(DEFAULT_COLUMNS);
    setIncludeBenchmarks(true);
    setGranularity("week");
    setSeriesKind("course");
    setDelivery("download");
    setRecipientsText("");
    setScheduleEnabled(initialScheduleEnabled);
    setScheduleName("");
    setCadence("weekly");
    setTime("07:00");
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    setCadenceOpen(false);
    setDatePresetOpen(false);
    setGranularityOpen(false);
    setSeriesKindOpen(false);
    setSubmitting(false);
    setError(null);
  }, [open, initialScheduleEnabled]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, submitting]);

  const datePresetLabel = useMemo(() => {
    if (datePreset === "7d") return "Last 7 days";
    if (datePreset === "90d") return "Last 90 days";
    if (datePreset === "custom") return "Custom range";
    return "Last 30 days";
  }, [datePreset]);

  const cadenceLabel = useMemo(() => {
    if (cadence === "daily") return "Daily";
    if (cadence === "monthly") return "Monthly";
    return "Weekly";
  }, [cadence]);

  const granularityLabel = useMemo(() => {
    if (granularity === "day") return "Day";
    if (granularity === "month") return "Month";
    return "Week";
  }, [granularity]);

  const seriesKindLabel = useMemo(() => {
    return seriesKind === "batch" ? "Batch" : "Course";
  }, [seriesKind]);

  const estimateLabel = useMemo(() => {
    if (dataset === "session_metrics") return formatEstimate(estimates.sessionMetricsRows);
    if (dataset === "outlier_findings") return formatEstimate(estimates.outlierFindingsRows);
    return "Row count varies";
  }, [dataset, estimates]);

  if (!open) return null;

  function toggleColumn(column: SliExportColumn) {
    setColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  }

  function selectAllColumns() {
    setColumns(ALL_SESSION_COLUMNS);
  }

  async function onSubmit() {
    if (dataset === "session_metrics" && columns.length === 0) {
      setError("Select at least one column.");
      return;
    }
    if (delivery === "send_recipients" && !recipientsText.trim()) {
      setError("Add at least one recipient email.");
      return;
    }
    if (scopeMode === "course" && !courseId.trim()) {
      setError("Enter a course ID.");
      return;
    }
    if (scopeMode === "batch" && !batchId.trim()) {
      setError("Enter a batch ID.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const recipients = recipientsText
        .split(/[,;\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);

      const body: CreateSliExportBody = {
        dataset,
        format,
        scopeMode,
        datePreset,
        includeBenchmarks,
        granularity,
        seriesKind,
        delivery,
        scheduleEnabled,
        cadence: scheduleEnabled ? cadence : undefined,
        time: scheduleEnabled ? time : undefined,
        timezone: scheduleEnabled ? timezone : undefined,
        scheduleName: scheduleEnabled ? scheduleName || undefined : undefined,
        recipients:
          delivery === "send_recipients" || (scheduleEnabled && recipients.length > 0)
            ? recipients
            : undefined,
        columns: dataset === "session_metrics" ? columns : undefined,
        courseId: scopeMode === "course" ? courseId.trim() || undefined : undefined,
        batchId: scopeMode === "batch" ? batchId.trim() || undefined : undefined,
        filterSummary:
          scopeMode === "date_range"
            ? datePresetLabel
            : scopeMode === "course"
              ? courseId.trim()
                ? `Course ${courseId.trim()}`
                : "All sessions in a course"
              : scopeMode === "batch"
                ? batchId.trim()
                  ? `Batch ${batchId.trim()}`
                  : "All sessions in a batch"
                : sessionSearch.trim() || "Selected sessions",
      };

      if (datePreset === "custom") {
        if (startedFrom) body.startedFrom = new Date(startedFrom).toISOString();
        if (startedTo) body.startedTo = new Date(startedTo).toISOString();
      }

      const response = await createSuperLiveInsightsExport(body);
      onCreated(response.data.run, response.data.schedule);
      onClose();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not create export.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-[2px] sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-[840px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_12px_48px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)] motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6 py-5">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              New export
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--admin-on-surface-variant)]">
              {estimateLabel}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={submitting}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-8 overflow-y-auto bg-[var(--admin-bg)] p-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
              Dataset
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              {DATASET_OPTIONS.map((option) => {
                const selected = dataset === option.value;
                const available = capabilities.datasets.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!available}
                    onClick={() => {
                      setDataset(option.value);
                    }}
                    className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-40 ${
                      selected
                        ? "border-2 border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))]"
                        : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-outline)]"
                    }`}
                  >
                    <span
                      className={`block text-sm font-semibold ${
                        selected ? "text-[var(--admin-primary)]" : "text-[var(--admin-on-surface)]"
                      }`}
                    >
                      {option.label}
                    </span>
                    <span
                      className={`mt-1 block text-[12px] ${
                        selected
                          ? "text-[color-mix(in_srgb,var(--admin-primary)_80%,var(--admin-on-surface))]"
                          : "text-[var(--admin-on-surface-variant)]"
                      }`}
                    >
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
              Scope
            </h3>
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-[12px] text-[var(--admin-on-surface-variant)]">
                    Shortcuts:
                  </span>
                  {(
                    [
                      ["course", "All sessions in a course"],
                      ["batch", "All sessions in a batch"],
                      ["date_range", "All sessions in a date range"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setScopeMode(mode);
                      }}
                      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[12px] transition-colors ${
                        scopeMode === mode
                          ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                      }`}
                    >
                      {mode === "date_range" ? (
                        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : null}
                      {label}
                    </button>
                  ))}
                </div>

                {scopeMode === "date_range" ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <DropdownField
                      label={<span className="text-[12px]">Date preset</span>}
                      labelId={datePresetLabelId}
                      open={datePresetOpen}
                      onToggle={() => {
                        setDatePresetOpen((value) => !value);
                      }}
                      portalZIndex={85}
                      triggerContent={
                        <span className="flex w-full items-center gap-2 text-sm">
                          <span className="flex-1 text-left">{datePresetLabel}</span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform duration-200 ${datePresetOpen ? "rotate-180" : ""}`}
                          />
                        </span>
                      }
                      panelAriaLabel="Date presets"
                    >
                      <div className="p-1.5" role="listbox">
                        {(
                          [
                            ["7d", "Last 7 days"],
                            ["30d", "Last 30 days"],
                            ["90d", "Last 90 days"],
                            ["custom", "Custom range"],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            role="option"
                            aria-selected={datePreset === value}
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
                      <>
                        <div>
                          <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                            From
                          </label>
                          <input
                            type="datetime-local"
                            value={startedFrom}
                            onChange={(event) => {
                              setStartedFrom(event.target.value);
                            }}
                            className={fieldClassName}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                            To
                          </label>
                          <input
                            type="datetime-local"
                            value={startedTo}
                            onChange={(event) => {
                              setStartedTo(event.target.value);
                            }}
                            className={fieldClassName}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {scopeMode === "course" ? (
                  <div>
                    <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                      Course ID
                    </label>
                    <input
                      type="text"
                      value={courseId}
                      onChange={(event) => {
                        setCourseId(event.target.value);
                      }}
                      placeholder="Course UUID"
                      className={fieldClassName}
                    />
                  </div>
                ) : null}

                {scopeMode === "batch" ? (
                  <div>
                    <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                      Batch ID
                    </label>
                    <input
                      type="text"
                      value={batchId}
                      onChange={(event) => {
                        setBatchId(event.target.value);
                      }}
                      placeholder="Batch UUID"
                      className={fieldClassName}
                    />
                  </div>
                ) : null}

                {scopeMode === "sessions" || scopeMode === "date_range" ? (
                  <div>
                    <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                      Sessions
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-2.5 left-3 h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]" />
                      <input
                        type="search"
                        value={sessionSearch}
                        onChange={(event) => {
                          setSessionSearch(event.target.value);
                          if (event.target.value.trim()) setScopeMode("sessions");
                        }}
                        placeholder="Search sessions…"
                        className={`${fieldClassName} pl-9`}
                      />
                    </div>
                  </div>
                ) : null}

                {dataset === "trend_series" ? (
                  <DropdownField
                    label={<span className="text-[12px]">Granularity</span>}
                    labelId={granularityLabelId}
                    open={granularityOpen}
                    onToggle={() => {
                      setGranularityOpen((value) => !value);
                    }}
                    portalZIndex={85}
                    triggerContent={
                      <span className="flex w-full items-center gap-2 text-sm">
                        <span className="flex-1 text-left">{granularityLabel}</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${granularityOpen ? "rotate-180" : ""}`}
                        />
                      </span>
                    }
                    panelAriaLabel="Granularity"
                  >
                    <div className="p-1.5" role="listbox">
                      {(
                        [
                          ["day", "Day"],
                          ["week", "Week"],
                          ["month", "Month"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="option"
                          aria-selected={granularity === value}
                          className={dropdownItemClassName}
                          onClick={() => {
                            setGranularity(value);
                            setGranularityOpen(false);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                ) : null}

                {dataset === "series_rollup" ? (
                  <DropdownField
                    label={<span className="text-[12px]">Series kind</span>}
                    labelId={seriesKindLabelId}
                    open={seriesKindOpen}
                    onToggle={() => {
                      setSeriesKindOpen((value) => !value);
                    }}
                    portalZIndex={85}
                    triggerContent={
                      <span className="flex w-full items-center gap-2 text-sm">
                        <span className="flex-1 text-left">{seriesKindLabel}</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${seriesKindOpen ? "rotate-180" : ""}`}
                        />
                      </span>
                    }
                    panelAriaLabel="Series kind"
                  >
                    <div className="p-1.5" role="listbox">
                      {(
                        [
                          ["course", "Course"],
                          ["batch", "Batch"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="option"
                          aria-selected={seriesKind === value}
                          className={dropdownItemClassName}
                          onClick={() => {
                            setSeriesKind(value);
                            setSeriesKindOpen(false);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                ) : null}
              </div>
            </div>
          </section>

          {dataset === "session_metrics" ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  Columns
                </h3>
                <button
                  type="button"
                  onClick={selectAllColumns}
                  className="text-[12px] font-medium text-[var(--admin-primary)] hover:underline"
                >
                  Select all
                </button>
              </div>
              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <p className="mb-3 text-[11px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Session Data
                    </p>
                    <div className="flex flex-col gap-3">
                      {SESSION_DATA_COLUMNS.map((option) => {
                        const checked = columns.includes(option.value);
                        return (
                          <label
                            key={option.value}
                            className="flex cursor-pointer items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                toggleColumn(option.value);
                              }}
                              className="h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                            />
                            <span
                              className={`font-mono text-[13px] ${
                                checked
                                  ? "text-[var(--admin-on-surface)]"
                                  : "text-[var(--admin-on-surface-variant)]"
                              }`}
                            >
                              {option.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-[11px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Metrics
                    </p>
                    <div className="flex flex-col gap-3">
                      {METRICS_COLUMNS.map((option) => {
                        const checked = columns.includes(option.value);
                        return (
                          <label
                            key={option.value}
                            className="flex cursor-pointer items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                toggleColumn(option.value);
                              }}
                              className="h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                            />
                            <span
                              className={`font-mono text-[13px] ${
                                checked
                                  ? "text-[var(--admin-on-surface)]"
                                  : "text-[var(--admin-on-surface-variant)]"
                              }`}
                            >
                              {option.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2.5 text-[12px] text-[var(--admin-on-surface-variant)]">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--admin-on-surface-variant)]" />
                <p>
                  This export contains aggregate counts only. For learner names and join times,
                  export from{" "}
                  <Link
                    href="/admin/reports/live-class-attendance"
                    className="font-semibold text-[var(--admin-primary)] hover:underline"
                  >
                    Live Class Attendance
                  </Link>
                  .
                </p>
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
              Benchmarks
            </h3>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <input
                type="checkbox"
                checked={includeBenchmarks}
                onChange={(event) => {
                  setIncludeBenchmarks(event.target.checked);
                }}
                className="mt-0.5 h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
              />
              <span>
                <span className="block text-sm text-[var(--admin-on-surface)]">
                  Include the tenant and course averages as extra columns
                </span>
                <span className="mt-0.5 block text-[12px] text-[var(--admin-on-surface-variant)]">
                  Adds tenant_avg_rate and course_avg_rate
                </span>
              </span>
            </label>
          </section>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <section className="flex flex-col gap-3">
              <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                Format
              </h3>
              <div className="flex overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                {capabilities.formats.map((item, index) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setFormat(item);
                    }}
                    className={`flex-1 py-2 text-[13px] transition-colors ${
                      index < capabilities.formats.length - 1
                        ? "border-r border-[var(--admin-border)]"
                        : ""
                    } ${
                      format === item
                        ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] font-semibold text-[var(--admin-primary)]"
                        : "text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-low)]"
                    }`}
                  >
                    {item.toUpperCase()}
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                Delivery
              </h3>
              <div className="flex flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                {(
                  [
                    ["download", "Download now"],
                    ["email_me", "Email me when ready"],
                    ["send_recipients", "Send to recipients"],
                  ] as const
                ).map(([value, label]) => {
                  const emailDisabled = value !== "download" && !capabilities.canEmailDelivery;
                  return (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-2 ${emailDisabled ? "opacity-40" : ""}`}
                    >
                      <input
                        type="radio"
                        name="sli-delivery"
                        checked={delivery === value}
                        disabled={emailDisabled}
                        onChange={() => {
                          setDelivery(value);
                        }}
                        className="h-4 w-4 border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                      />
                      <span className="text-sm text-[var(--admin-on-surface)]">{label}</span>
                    </label>
                  );
                })}
                {delivery === "send_recipients" ? (
                  <textarea
                    value={recipientsText}
                    onChange={(event) => {
                      setRecipientsText(event.target.value);
                    }}
                    placeholder="recipient@example.com, …"
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-outline)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                  />
                ) : null}
              </div>
            </section>
          </div>

          {capabilities.canSchedule ? (
            <section className="flex flex-col gap-3 pb-2">
              <div className="flex items-center justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-[var(--admin-on-surface-variant)]" />
                  <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                    Schedule this export
                  </span>
                </div>
                <PolicyToggle
                  checked={scheduleEnabled}
                  onChange={setScheduleEnabled}
                  label="Schedule this export"
                />
              </div>
              {scheduleEnabled ? (
                <div className="grid gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                      Schedule name
                    </label>
                    <input
                      type="text"
                      value={scheduleName}
                      onChange={(event) => {
                        setScheduleName(event.target.value);
                      }}
                      placeholder="Monthly live teaching review"
                      className={fieldClassName}
                    />
                  </div>
                  <DropdownField
                    label={<span className="text-[12px]">Cadence</span>}
                    labelId={cadenceLabelId}
                    open={cadenceOpen}
                    onToggle={() => {
                      setCadenceOpen((value) => !value);
                    }}
                    portalZIndex={85}
                    triggerContent={
                      <span className="flex w-full items-center gap-2 text-sm">
                        <span className="flex-1 text-left">{cadenceLabel}</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${cadenceOpen ? "rotate-180" : ""}`}
                        />
                      </span>
                    }
                    panelAriaLabel="Cadence"
                  >
                    <div className="p-1.5" role="listbox">
                      {(
                        [
                          ["daily", "Daily"],
                          ["weekly", "Weekly"],
                          ["monthly", "Monthly"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="option"
                          aria-selected={cadence === value}
                          className={dropdownItemClassName}
                          onClick={() => {
                            setCadence(value);
                            setCadenceOpen(false);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                  <div>
                    <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                      Time
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => {
                        setTime(event.target.value);
                      }}
                      className={fieldClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                      Timezone
                    </label>
                    <input
                      type="text"
                      value={timezone}
                      onChange={(event) => {
                        setTimezone(event.target.value);
                      }}
                      className={fieldClassName}
                    />
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {error ? (
            <p className="text-sm text-[var(--admin-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className={`${secondaryButtonClassName} h-10`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onSubmit()}
            className={`${primaryButtonClassName} h-10 gap-2`}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create export
          </button>
        </div>
      </div>
    </div>
  );
}
