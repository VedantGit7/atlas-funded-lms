"use client";

import { useEffect, useState } from "react";
import { Calendar, Search } from "lucide-react";
import {
  liveClassAttendanceExportsApi,
  type CreateLcaExportBody,
  type LcaExportCadence,
  type LcaExportColumn,
  type LcaExportDataset,
  type LcaExportDatePreset,
  type LcaExportDelivery,
  type LcaExportFormat,
  type LcaExportHistoryItem,
  type LcaExportRegistrationMode,
  type LcaExportScheduleItem,
  type LcaExportScopeMode,
  type LiveClassAttendanceExportsPayload,
} from "./admin-live-class-attendance-exports-api";
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
  insightFieldLabelClassName,
  insightInputClassName,
  type InsightColumnOption,
  type InsightDatasetOption,
} from "./insight-export-dialog-kit";
import { useNewExportForm } from "./use-new-export-form";

const DATASET_OPTIONS: Array<InsightDatasetOption<LcaExportDataset>> = [
  { value: "sessions", label: "Sessions", description: "One row per session" },
  {
    value: "attendees",
    label: "Attendees",
    description: "One row per registration, including learners who never joined",
  },
  {
    value: "learner_summary",
    label: "Learner summary",
    description: "One row per learner across all sessions",
  },
  {
    value: "series_rollup",
    label: "Series rollup",
    description: "One row per course or batch",
  },
];

const COLUMN_OPTIONS: Array<InsightColumnOption<LcaExportColumn>> = [
  { value: "learner_name", label: "learner_name" },
  { value: "email", label: "email", pii: true },
  { value: "status", label: "status" },
  { value: "joined_at", label: "joined_at" },
  { value: "left_at", label: "left_at" },
  { value: "duration_seconds", label: "duration_seconds" },
  { value: "coverage_pct", label: "coverage" },
  { value: "batch_name", label: "batch" },
  { value: "registered_at", label: "registered_on" },
  { value: "session_title", label: "session_title" },
  { value: "course_title", label: "course" },
];

const DEFAULT_COLUMNS: LcaExportColumn[] = [
  "learner_name",
  "email",
  "status",
  "joined_at",
  "left_at",
  "duration_seconds",
  "coverage_pct",
  "session_title",
  "course_title",
];

const DATE_PRESET_OPTIONS = [
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["90d", "Last 90 days"],
  ["custom", "Custom range"],
] as const satisfies ReadonlyArray<readonly [LcaExportDatePreset, string]>;

const SCOPE_SHORTCUTS = [
  ["course", "All sessions in a course"],
  ["batch", "All sessions in a batch"],
  ["date_range", "All sessions in a date range"],
] as const satisfies ReadonlyArray<readonly [LcaExportScopeMode, string]>;

function formatEstimate(value: number | null): string {
  if (value == null) return "row count varies";
  return `Produces ~${value.toLocaleString()} rows`;
}

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function LiveClassAttendanceNewExportModal({
  open,
  capabilities,
  estimates,
  initialScheduleEnabled,
  onClose,
  onCreated,
}: {
  open: boolean;
  capabilities: LiveClassAttendanceExportsPayload["capabilities"];
  estimates: LiveClassAttendanceExportsPayload["estimates"];
  initialScheduleEnabled: boolean;
  onClose: () => void;
  onCreated: (run: LcaExportHistoryItem, schedule: LcaExportScheduleItem | null) => void;
}) {
  const form = useNewExportForm<LcaExportFormat, LcaExportDelivery, LcaExportCadence>({
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
  const [dataset, setDataset] = useState<LcaExportDataset>("attendees");
  const [scopeMode, setScopeMode] = useState<LcaExportScopeMode>("date_range");
  const [datePreset, setDatePreset] = useState<LcaExportDatePreset>("30d");
  const [scheduledFrom, setScheduledFrom] = useState("");
  const [scheduledTo, setScheduledTo] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [columns, setColumns] = useState<LcaExportColumn[]>(DEFAULT_COLUMNS);
  const [registrationMode, setRegistrationMode] =
    useState<LcaExportRegistrationMode>("include_never_joined");

  useEffect(() => {
    if (!open) return;
    setDataset("attendees");
    setScopeMode("date_range");
    setDatePreset("30d");
    setScheduledFrom("");
    setScheduledTo("");
    setSessionSearch("");
    setColumns(DEFAULT_COLUMNS);
    setRegistrationMode("include_never_joined");
  }, [open]);

  if (!open) return null;

  const datePresetLabel =
    DATE_PRESET_OPTIONS.find(([value]) => value === datePreset)?.[1] ?? "Last 30 days";

  function toggleColumn(column: LcaExportColumn) {
    setColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  }

  async function onSubmit() {
    if (columns.length === 0) return form.fail("Select at least one column.");
    if (form.delivery === "send_recipients" && form.recipients.length === 0) {
      return form.fail("Add at least one recipient email.");
    }

    const recipients = form.recipients;
    const body: CreateLcaExportBody = {
      dataset,
      format: form.format,
      scopeMode,
      datePreset,
      registrationMode,
      columns,
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
      filterSummary:
        scopeMode === "date_range"
          ? datePresetLabel
          : scopeMode === "course"
            ? "All sessions in a course"
            : scopeMode === "batch"
              ? "All sessions in a batch"
              : sessionSearch.trim() || "Selected sessions",
    };

    if (datePreset === "custom") {
      if (scheduledFrom) body.scheduledFrom = new Date(scheduledFrom).toISOString();
      if (scheduledTo) body.scheduledTo = new Date(scheduledTo).toISOString();
    }

    return form.submit(() => liveClassAttendanceExportsApi.create(body), onCreated);
  }

  return (
    <InsightDialogFrame
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
          columns={4}
        />
      </InsightDialogSection>

      <InsightDialogSection title="Scope">
        <InsightPanel>
          <div className="flex flex-col gap-4">
            <div>
              <label className={insightFieldLabelClassName}>Select sessions</label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]" />
                <input
                  type="search"
                  value={sessionSearch}
                  onChange={(event) => {
                    setSessionSearch(event.target.value);
                  }}
                  placeholder="Search sessions…"
                  className={`${insightInputClassName} pl-9`}
                />
              </div>
            </div>
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
                        value={scheduledFrom}
                        onChange={(event) => {
                          setScheduledFrom(event.target.value);
                        }}
                        className={insightInputClassName}
                      />
                    </div>
                    <div>
                      <label className={insightFieldLabelClassName}>To</label>
                      <input
                        type="datetime-local"
                        value={scheduledTo}
                        onChange={(event) => {
                          setScheduledTo(event.target.value);
                        }}
                        className={insightInputClassName}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </InsightPanel>
      </InsightDialogSection>

      <InsightColumnSection
        groups={[{ options: COLUMN_OPTIONS }]}
        selected={columns}
        onToggle={toggleColumn}
        onSelectAll={() => {
          setColumns(COLUMN_OPTIONS.map((item) => item.value));
        }}
      />

      {dataset === "attendees" ? (
        <InsightDialogSection title="Registration handling">
          <div className="flex flex-col gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:flex-row sm:gap-6">
            {(
              [
                [
                  "include_never_joined",
                  "Include learners who never joined",
                  estimates.includeNeverJoinedRows,
                ],
                ["attendees_only", "Attendees only", estimates.attendeesOnlyRows],
              ] as const
            ).map(([mode, label, estimate]) => (
              <label key={mode} className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="registration"
                  checked={registrationMode === mode}
                  onChange={() => {
                    setRegistrationMode(mode);
                  }}
                  className="mt-0.5 h-4 w-4 border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                />
                <span>
                  <span className="block text-sm text-[var(--admin-on-surface)]">{label}</span>
                  <span className="block text-[12px] text-[var(--admin-on-surface-variant)]">
                    {formatEstimate(estimate)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </InsightDialogSection>
      ) : null}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <InsightFormatSection
          formats={capabilities.formats}
          value={form.format}
          onChange={form.setFormat}
        />
        <InsightDeliverySection form={form} emailEnabled={capabilities.canEmailDelivery} />
      </div>

      {capabilities.canSchedule ? (
        <InsightScheduleSection form={form} namePlaceholder="Weekly attendance register" />
      ) : null}
    </InsightDialogFrame>
  );
}
