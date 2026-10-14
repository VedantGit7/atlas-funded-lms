"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Calendar, Info, Search } from "lucide-react";
import {
  superLiveInsightsExportsApi,
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
import {
  InsightColumnSection,
  InsightDatasetCards,
  InsightDeliverySection,
  InsightDialogFrame,
  InsightDialogSection,
  InsightDropdown,
  InsightFormatSection,
  InsightPanel,
  InsightScheduleSection,
  insightCheckboxClassName,
  insightFieldLabelClassName,
  insightInputClassName,
  type InsightColumnOption,
  type InsightDatasetOption,
} from "./insight-export-dialog-kit";
import { useNewExportForm } from "./use-new-export-form";

const DATASET_OPTIONS: Array<InsightDatasetOption<SliExportDataset>> = [
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

const SESSION_DATA_COLUMNS: Array<InsightColumnOption<SliExportColumn>> = [
  { value: "title", label: "Live class" },
  { value: "status", label: "Status" },
  { value: "course_title", label: "Course" },
  { value: "batch_name", label: "Batch" },
  { value: "scheduled_at", label: "Scheduled" },
  { value: "started_at", label: "Started" },
  { value: "ended_at", label: "Ended" },
  { value: "duration_seconds", label: "Duration" },
];

const METRICS_COLUMNS: Array<InsightColumnOption<SliExportColumn>> = [
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

const COLUMN_GROUPS = [
  { title: "Session data", options: SESSION_DATA_COLUMNS },
  { title: "Metrics", options: METRICS_COLUMNS },
];

const DATE_PRESET_OPTIONS = [
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["90d", "Last 90 days"],
  ["custom", "Custom range"],
] as const satisfies ReadonlyArray<readonly [SliExportDatePreset, string]>;

const GRANULARITY_OPTIONS = [
  ["day", "Day"],
  ["week", "Week"],
  ["month", "Month"],
] as const satisfies ReadonlyArray<readonly [SliExportGranularity, string]>;

const SERIES_KIND_OPTIONS = [
  ["course", "Course"],
  ["batch", "Batch"],
] as const satisfies ReadonlyArray<readonly [SliExportSeriesKind, string]>;

const SCOPE_SHORTCUTS = [
  ["course", "All sessions in a course"],
  ["batch", "All sessions in a batch"],
  ["date_range", "All sessions in a date range"],
] as const satisfies ReadonlyArray<readonly [SliExportScopeMode, string]>;

function formatEstimate(value: number | null): string {
  if (value == null) return "Row count varies";
  return `Produces ~${value.toLocaleString()} rows`;
}

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
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
  const form = useNewExportForm<SliExportFormat, SliExportDelivery, SliExportCadence>({
    open,
    onClose,
    initialScheduleEnabled,
    defaults: {
      format: "csv",
      delivery: "download",
      cadence: "weekly",
      time: "07:00",
      timezone: browserTimezone,
    },
  });
  const [dataset, setDataset] = useState<SliExportDataset>("session_metrics");
  const [scopeMode, setScopeMode] = useState<SliExportScopeMode>("date_range");
  const [datePreset, setDatePreset] = useState<SliExportDatePreset>("30d");
  const [startedFrom, setStartedFrom] = useState("");
  const [startedTo, setStartedTo] = useState("");
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [columns, setColumns] = useState<SliExportColumn[]>(ALL_SESSION_COLUMNS);
  const [includeBenchmarks, setIncludeBenchmarks] = useState(true);
  const [granularity, setGranularity] = useState<SliExportGranularity>("week");
  const [seriesKind, setSeriesKind] = useState<SliExportSeriesKind>("course");

  useEffect(() => {
    if (!open) return;
    setDataset("session_metrics");
    setScopeMode("date_range");
    setDatePreset("30d");
    setStartedFrom("");
    setStartedTo("");
    setCourseId("");
    setBatchId("");
    setSessionSearch("");
    setColumns(ALL_SESSION_COLUMNS);
    setIncludeBenchmarks(true);
    setGranularity("week");
    setSeriesKind("course");
  }, [open]);

  if (!open) return null;

  const datePresetLabel =
    DATE_PRESET_OPTIONS.find(([value]) => value === datePreset)?.[1] ?? "Last 30 days";
  const estimateLabel =
    dataset === "session_metrics"
      ? formatEstimate(estimates.sessionMetricsRows)
      : dataset === "outlier_findings"
        ? formatEstimate(estimates.outlierFindingsRows)
        : "Row count varies";

  function toggleColumn(column: SliExportColumn) {
    setColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  }

  async function onSubmit() {
    if (dataset === "session_metrics" && columns.length === 0) {
      return form.fail("Select at least one column.");
    }
    if (form.delivery === "send_recipients" && form.recipients.length === 0) {
      return form.fail("Add at least one recipient email.");
    }
    if (scopeMode === "course" && !courseId.trim()) return form.fail("Enter a course ID.");
    if (scopeMode === "batch" && !batchId.trim()) return form.fail("Enter a batch ID.");

    const recipients = form.recipients;
    const body: CreateSliExportBody = {
      dataset,
      format: form.format,
      scopeMode,
      datePreset,
      includeBenchmarks,
      granularity,
      seriesKind,
      delivery: form.delivery,
      scheduleEnabled: form.scheduleEnabled,
      cadence: form.scheduleEnabled ? form.cadence : undefined,
      time: form.scheduleEnabled ? form.time : undefined,
      timezone: form.scheduleEnabled ? form.timezone : undefined,
      scheduleName: form.scheduleEnabled ? form.scheduleName || undefined : undefined,
      recipients:
        form.delivery === "send_recipients" || (form.scheduleEnabled && recipients.length > 0)
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

    return form.submit(() => superLiveInsightsExportsApi.create(body), onCreated);
  }

  return (
    <InsightDialogFrame
      subtitle={estimateLabel}
      saving={form.saving}
      error={form.error}
      onClose={onClose}
      onSubmit={() => void onSubmit()}
    >
      <InsightDialogSection title="Dataset">
        <InsightDatasetCards
          options={DATASET_OPTIONS}
          value={dataset}
          onChange={setDataset}
          available={(option) => capabilities.datasets.includes(option)}
          columns={4}
        />
      </InsightDialogSection>

      <InsightDialogSection title="Scope">
        <InsightPanel>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[12px] text-[var(--admin-on-surface-variant)]">
                Shortcuts:
              </span>
              {SCOPE_SHORTCUTS.map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={scopeMode === mode}
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
                <InsightDropdown
                  label="Date preset"
                  value={datePreset}
                  options={DATE_PRESET_OPTIONS}
                  onChange={setDatePreset}
                />
                {datePreset === "custom" ? (
                  <>
                    <div>
                      <label className={insightFieldLabelClassName}>From</label>
                      <input
                        type="datetime-local"
                        value={startedFrom}
                        onChange={(event) => {
                          setStartedFrom(event.target.value);
                        }}
                        className={insightInputClassName}
                      />
                    </div>
                    <div>
                      <label className={insightFieldLabelClassName}>To</label>
                      <input
                        type="datetime-local"
                        value={startedTo}
                        onChange={(event) => {
                          setStartedTo(event.target.value);
                        }}
                        className={insightInputClassName}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {scopeMode === "course" ? (
              <div>
                <label className={insightFieldLabelClassName}>Course ID</label>
                <input
                  type="text"
                  value={courseId}
                  onChange={(event) => {
                    setCourseId(event.target.value);
                  }}
                  placeholder="Course UUID"
                  className={insightInputClassName}
                />
              </div>
            ) : null}

            {scopeMode === "batch" ? (
              <div>
                <label className={insightFieldLabelClassName}>Batch ID</label>
                <input
                  type="text"
                  value={batchId}
                  onChange={(event) => {
                    setBatchId(event.target.value);
                  }}
                  placeholder="Batch UUID"
                  className={insightInputClassName}
                />
              </div>
            ) : null}

            {scopeMode === "sessions" || scopeMode === "date_range" ? (
              <div>
                <label className={insightFieldLabelClassName}>Sessions</label>
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
                    className={`${insightInputClassName} pl-9`}
                  />
                </div>
              </div>
            ) : null}

            {dataset === "trend_series" ? (
              <InsightDropdown
                label="Granularity"
                value={granularity}
                options={GRANULARITY_OPTIONS}
                onChange={setGranularity}
              />
            ) : null}

            {dataset === "series_rollup" ? (
              <InsightDropdown
                label="Series kind"
                value={seriesKind}
                options={SERIES_KIND_OPTIONS}
                onChange={setSeriesKind}
              />
            ) : null}
          </div>
        </InsightPanel>
      </InsightDialogSection>

      {dataset === "session_metrics" ? (
        <InsightColumnSection
          groups={COLUMN_GROUPS}
          selected={columns}
          onToggle={toggleColumn}
          onSelectAll={() => {
            setColumns(ALL_SESSION_COLUMNS);
          }}
        >
          <div className="flex items-start gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2.5 text-[12px] text-[var(--admin-on-surface-variant)]">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--admin-on-surface-variant)]" />
            <p>
              This export contains aggregate counts only. For learner names and join times, export
              from{" "}
              <Link
                href="/admin/reports/live-class-attendance"
                className="font-semibold text-[var(--admin-primary)] hover:underline"
              >
                Live Class Attendance
              </Link>
              .
            </p>
          </div>
        </InsightColumnSection>
      ) : null}

      <InsightDialogSection title="Benchmarks">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <input
            type="checkbox"
            checked={includeBenchmarks}
            onChange={(event) => {
              setIncludeBenchmarks(event.target.checked);
            }}
            className={`mt-0.5 ${insightCheckboxClassName}`}
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
      </InsightDialogSection>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <InsightFormatSection
          formats={capabilities.formats}
          value={form.format}
          onChange={form.setFormat}
        />
        <InsightDeliverySection form={form} emailEnabled={capabilities.canEmailDelivery} />
      </div>

      {capabilities.canSchedule ? (
        <InsightScheduleSection form={form} namePlaceholder="Monthly live teaching review" />
      ) : null}
    </InsightDialogFrame>
  );
}
