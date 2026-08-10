"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, Calendar, ChevronDown, Loader2, Search, X } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  createLiveClassAttendanceExport,
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

const DATASET_OPTIONS: Array<{
  value: LcaExportDataset;
  label: string;
  description: string;
}> = [
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

const COLUMN_OPTIONS: Array<{ value: LcaExportColumn; label: string; pii?: boolean }> = [
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
  if (value == null) return "row count varies";
  return `Produces ~${value.toLocaleString()} rows`;
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
  const titleId = useId();
  const deliveryLabelId = useId();
  const cadenceLabelId = useId();
  const datePresetLabelId = useId();

  const [dataset, setDataset] = useState<LcaExportDataset>("attendees");
  const [format, setFormat] = useState<LcaExportFormat>("csv");
  const [scopeMode, setScopeMode] = useState<LcaExportScopeMode>("date_range");
  const [datePreset, setDatePreset] = useState<LcaExportDatePreset>("30d");
  const [scheduledFrom, setScheduledFrom] = useState("");
  const [scheduledTo, setScheduledTo] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [columns, setColumns] = useState<LcaExportColumn[]>(DEFAULT_COLUMNS);
  const [registrationMode, setRegistrationMode] =
    useState<LcaExportRegistrationMode>("include_never_joined");
  const [delivery, setDelivery] = useState<LcaExportDelivery>("download");
  const [recipientsText, setRecipientsText] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [cadence, setCadence] = useState<LcaExportCadence>("weekly");
  const [time, setTime] = useState("07:00");
  const [timezone, setTimezone] = useState("UTC");
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [cadenceOpen, setCadenceOpen] = useState(false);
  const [datePresetOpen, setDatePresetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDataset("attendees");
    setFormat("csv");
    setScopeMode("date_range");
    setDatePreset("30d");
    setScheduledFrom("");
    setScheduledTo("");
    setSessionSearch("");
    setColumns(DEFAULT_COLUMNS);
    setRegistrationMode("include_never_joined");
    setDelivery("download");
    setRecipientsText("");
    setScheduleEnabled(initialScheduleEnabled);
    setScheduleName("");
    setCadence("weekly");
    setTime("07:00");
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    setDeliveryOpen(false);
    setCadenceOpen(false);
    setDatePresetOpen(false);
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

  const deliveryLabel = useMemo(() => {
    if (delivery === "email_me") return "Email me when ready";
    if (delivery === "send_recipients") return "Send to recipients";
    return "Download now";
  }, [delivery]);

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

  if (!open) return null;

  function toggleColumn(column: LcaExportColumn) {
    setColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  }

  function selectAllColumns() {
    setColumns(COLUMN_OPTIONS.map((item) => item.value));
  }

  async function onSubmit() {
    if (columns.length === 0) {
      setError("Select at least one column.");
      return;
    }
    if (delivery === "send_recipients" && !recipientsText.trim()) {
      setError("Add at least one recipient email.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const recipients = recipientsText
        .split(/[,;\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);

      const body: CreateLcaExportBody = {
        dataset,
        format,
        scopeMode,
        datePreset,
        registrationMode,
        columns,
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

      const response = await createLiveClassAttendanceExport(body);
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
          <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
            New export
          </h2>
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
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setDataset(option.value);
                    }}
                    className={`rounded-lg border p-3 text-left transition-colors ${
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
                <div>
                  <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                    Select sessions
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-2.5 left-3 h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]" />
                    <input
                      type="search"
                      value={sessionSearch}
                      onChange={(event) => {
                        setSessionSearch(event.target.value);
                      }}
                      placeholder="Search sessions…"
                      className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] pr-3 pl-9 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-outline)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    />
                  </div>
                </div>
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
                            value={scheduledFrom}
                            onChange={(event) => {
                              setScheduledFrom(event.target.value);
                            }}
                            className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                            To
                          </label>
                          <input
                            type="datetime-local"
                            value={scheduledTo}
                            onChange={(event) => {
                              setScheduledTo(event.target.value);
                            }}
                            className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm"
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

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
              <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                {COLUMN_OPTIONS.map((option) => {
                  const checked = columns.includes(option.value);
                  return (
                    <label key={option.value} className="flex cursor-pointer items-center gap-2">
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
                      {option.pii ? (
                        <span className="inline-flex items-center gap-1 rounded-sm border border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-[var(--admin-warning)] uppercase">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          PII
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          </section>

          {dataset === "attendees" ? (
            <section className="flex flex-col gap-3">
              <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                Registration handling
              </h3>
              <div className="flex flex-col gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:flex-row sm:gap-6">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="registration"
                    checked={registrationMode === "include_never_joined"}
                    onChange={() => {
                      setRegistrationMode("include_never_joined");
                    }}
                    className="mt-0.5 h-4 w-4 border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                  />
                  <span>
                    <span className="block text-sm text-[var(--admin-on-surface)]">
                      Include learners who never joined
                    </span>
                    <span className="block text-[12px] text-[var(--admin-on-surface-variant)]">
                      {formatEstimate(estimates.includeNeverJoinedRows)}
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="registration"
                    checked={registrationMode === "attendees_only"}
                    onChange={() => {
                      setRegistrationMode("attendees_only");
                    }}
                    className="mt-0.5 h-4 w-4 border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                  />
                  <span>
                    <span className="block text-sm text-[var(--admin-on-surface)]">
                      Attendees only
                    </span>
                    <span className="block text-[12px] text-[var(--admin-on-surface-variant)]">
                      {formatEstimate(estimates.attendeesOnlyRows)}
                    </span>
                  </span>
                </label>
              </div>
            </section>
          ) : null}

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
              <DropdownField
                label={<span className="sr-only">Delivery</span>}
                labelId={deliveryLabelId}
                open={deliveryOpen}
                onToggle={() => {
                  setDeliveryOpen((value) => !value);
                }}
                portalZIndex={85}
                triggerContent={
                  <span className="flex w-full items-center gap-2 text-sm">
                    <span className="flex-1 text-left">{deliveryLabel}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${deliveryOpen ? "rotate-180" : ""}`}
                    />
                  </span>
                }
                panelAriaLabel="Delivery options"
              >
                <div className="p-1.5" role="listbox">
                  {(
                    [
                      ["download", "Download now"],
                      ["email_me", "Email me when ready"],
                      ["send_recipients", "Send to recipients"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={delivery === value}
                      className={dropdownItemClassName}
                      onClick={() => {
                        setDelivery(value);
                        setDeliveryOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </DropdownField>
              {delivery === "send_recipients" ? (
                <input
                  type="text"
                  value={recipientsText}
                  onChange={(event) => {
                    setRecipientsText(event.target.value);
                  }}
                  placeholder="recipient@example.com, …"
                  className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm"
                />
              ) : null}
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
                      placeholder="Weekly attendance register"
                      className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm"
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
                      className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm"
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
                      className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm"
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
            className={`${ghostButtonClassName} h-10`}
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
