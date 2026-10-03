"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, Calendar, ChevronDown, Info, Loader2, Search, X } from "lucide-react";
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
  createResourceUsageExport,
  type CreateRuExportBody,
  type ResourceUsageExportsPayload,
  type RuExportCadence,
  type RuExportColumn,
  type RuExportDataset,
  type RuExportDatePreset,
  type RuExportDelivery,
  type RuExportFormat,
  type RuExportHistoryItem,
  type RuExportScheduleItem,
  type RuExportScopeMode,
} from "./admin-resource-usage-exports-api";

const DATASET_OPTIONS: Array<{
  value: RuExportDataset;
  label: string;
  description: string;
}> = [
  {
    value: "meter_snapshot",
    label: "Meter snapshot",
    description: "One row per meter, as of now",
  },
  {
    value: "metric_history",
    label: "Metric history",
    description: "One row per metric per period",
  },
  {
    value: "storage_breakdown",
    label: "Storage breakdown",
    description: "Current allocations by resource type",
  },
  {
    value: "inactive_learners",
    label: "Inactive learners",
    description: "Users with no activity past 90 days",
  },
  {
    value: "dormant_content",
    label: "Dormant content",
    description: "One row per dormant course",
  },
];

const COLUMNS_BY_DATASET: Record<
  RuExportDataset,
  Array<{ value: RuExportColumn; label: string; pii?: boolean }>
> = {
  meter_snapshot: [
    { value: "metric_key", label: "metric_key" },
    { value: "metric_label", label: "metric_label" },
    { value: "value", label: "value" },
    { value: "unit", label: "unit" },
    { value: "calculated_at", label: "calculated_at" },
  ],
  metric_history: [
    { value: "metric_key", label: "metric_key" },
    { value: "metric_label", label: "metric_label" },
    { value: "period", label: "period" },
    { value: "value", label: "value" },
    { value: "unit", label: "unit" },
    { value: "calculated_at", label: "calculated_at" },
  ],
  storage_breakdown: [
    { value: "resource_type", label: "resource_type" },
    { value: "object_count", label: "object_count" },
    { value: "storage_gb", label: "storage_gb" },
  ],
  inactive_learners: [
    { value: "membership_id", label: "membership_id" },
    { value: "learner_name", label: "learner_name" },
    { value: "email", label: "email", pii: true },
    { value: "status", label: "status" },
    { value: "last_active_at", label: "last_active_at" },
    { value: "created_at", label: "created_at" },
  ],
  dormant_content: [
    { value: "course_id", label: "course_id" },
    { value: "title", label: "title" },
    { value: "status", label: "status" },
    { value: "lesson_count", label: "lesson_count" },
    { value: "storage_gb", label: "storage_gb" },
    { value: "last_learner_activity_at", label: "last_learner_activity_at" },
    { value: "created_at", label: "created_at" },
  ],
};

function defaultColumnsForDataset(dataset: RuExportDataset): RuExportColumn[] {
  return COLUMNS_BY_DATASET[dataset].map((item) => item.value);
}

function defaultScopeModeForDataset(dataset: RuExportDataset): RuExportScopeMode {
  if (dataset === "metric_history") return "metric";
  if (dataset === "dormant_content" || dataset === "inactive_learners") return "search";
  return "all";
}

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

export function ResourceUsageNewExportModal({
  open,
  capabilities,
  estimates,
  initialScheduleEnabled,
  onClose,
  onCreated,
}: {
  open: boolean;
  capabilities: ResourceUsageExportsPayload["capabilities"];
  estimates: ResourceUsageExportsPayload["estimates"];
  initialScheduleEnabled: boolean;
  onClose: () => void;
  onCreated: (run: RuExportHistoryItem, schedule: RuExportScheduleItem | null) => void;
}) {
  const titleId = useId();
  const cadenceLabelId = useId();
  const datePresetLabelId = useId();

  const [dataset, setDataset] = useState<RuExportDataset>("meter_snapshot");
  const [format, setFormat] = useState<RuExportFormat>("csv");
  const [scopeMode, setScopeMode] = useState<RuExportScopeMode>("all");
  const [datePreset, setDatePreset] = useState<RuExportDatePreset>("30d");
  const [startedFrom, setStartedFrom] = useState("");
  const [startedTo, setStartedTo] = useState("");
  const [metricKey, setMetricKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [columns, setColumns] = useState<RuExportColumn[]>(
    defaultColumnsForDataset("meter_snapshot"),
  );
  const [delivery, setDelivery] = useState<RuExportDelivery>("download");
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [cadence, setCadence] = useState<RuExportCadence>("weekly");
  const [time, setTime] = useState("07:00");
  const [timezone, setTimezone] = useState("UTC");
  const [cadenceOpen, setCadenceOpen] = useState(false);
  const [datePresetOpen, setDatePresetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columnOptions = COLUMNS_BY_DATASET[dataset];

  useEffect(() => {
    if (!open) return;
    setDataset("meter_snapshot");
    setFormat("csv");
    setScopeMode("all");
    setDatePreset("30d");
    setStartedFrom("");
    setStartedTo("");
    setMetricKey("");
    setSearchQuery("");
    setColumns(defaultColumnsForDataset("meter_snapshot"));
    setDelivery("download");
    setRecipientInput("");
    setRecipients([]);
    setWebhookUrl("");
    setScheduleEnabled(initialScheduleEnabled);
    setScheduleName("");
    setCadence("weekly");
    setTime("07:00");
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
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

  const datasetEstimate = useMemo(() => {
    if (dataset === "meter_snapshot") return formatEstimate(estimates.meterSnapshotRows);
    if (dataset === "inactive_learners") return formatEstimate(estimates.inactiveLearnerRows);
    return null;
  }, [dataset, estimates]);

  if (!open) return null;

  function onDatasetChange(next: RuExportDataset) {
    setDataset(next);
    setScopeMode(defaultScopeModeForDataset(next));
    setColumns(defaultColumnsForDataset(next));
    setMetricKey("");
    setSearchQuery("");
  }

  function toggleColumn(column: RuExportColumn) {
    setColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  }

  function selectAllColumns() {
    setColumns(columnOptions.map((item) => item.value));
  }

  function addRecipient() {
    const email = recipientInput.trim();
    if (!email || recipients.includes(email)) {
      setRecipientInput("");
      return;
    }
    setRecipients((current) => [...current, email]);
    setRecipientInput("");
  }

  async function onSubmit() {
    if (columns.length === 0) {
      setError("Select at least one column.");
      return;
    }
    if (delivery === "send_recipients" && recipients.length === 0) {
      setError("Add at least one recipient email.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body: CreateRuExportBody = {
        dataset,
        format,
        scopeMode,
        datePreset,
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
        webhookUrl:
          delivery === "send_recipients" && webhookUrl.trim() ? webhookUrl.trim() : undefined,
      };

      if (scopeMode === "metric" && metricKey.trim()) {
        body.metricKey = metricKey.trim();
      }
      if (scopeMode === "search" && searchQuery.trim()) {
        body.q = searchQuery.trim();
      }

      if (datePreset === "custom") {
        if (startedFrom) body.startedFrom = new Date(startedFrom).toISOString();
        if (startedTo) body.startedTo = new Date(startedTo).toISOString();
      }

      if (dataset === "metric_history") {
        body.filterSummary = metricKey.trim()
          ? `${metricKey.trim()} · ${datePresetLabel}`
          : datePresetLabel;
      } else if (scopeMode === "search" && searchQuery.trim()) {
        body.filterSummary = searchQuery.trim();
      } else {
        body.filterSummary = DATASET_OPTIONS.find((item) => item.value === dataset)?.label;
      }

      const response = await createResourceUsageExport(body);
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DATASET_OPTIONS.map((option) => {
                const selected = dataset === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onDatasetChange(option.value);
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
                    {selected && datasetEstimate ? (
                      <span className="mt-2 block text-[11px] text-[var(--admin-on-surface-variant)]">
                        {datasetEstimate}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {dataset === "meter_snapshot" ? (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 text-sm text-[var(--admin-on-surface-variant)]">
                <Info
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]"
                  aria-hidden="true"
                />
                <span>{capabilities.unmeteredNote}</span>
              </div>
            ) : null}
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
              Scope
            </h3>
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <div className="flex flex-col gap-4">
                {dataset === "metric_history" ? (
                  <>
                    <div>
                      <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                        Metric key
                      </label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute top-2.5 left-3 h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]" />
                        <input
                          type="search"
                          value={metricKey}
                          onChange={(event) => {
                            setMetricKey(event.target.value);
                          }}
                          placeholder="usage.storage_gb"
                          className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] pr-3 pl-9 font-mono text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                        Leave empty to export all metrics with history.
                      </p>
                    </div>
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
                            <Calendar
                              className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                              aria-hidden="true"
                            />
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
                              className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-on-surface)]"
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
                              className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-on-surface)]"
                            />
                          </div>
                        </>
                      ) : null}
                    </div>
                  </>
                ) : dataset === "dormant_content" || dataset === "inactive_learners" ? (
                  <div>
                    <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                      Search filter
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-2.5 left-3 h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) => {
                          setSearchQuery(event.target.value);
                        }}
                        placeholder={
                          dataset === "dormant_content"
                            ? "Search courses by title..."
                            : "Search learners by name or email..."
                        }
                        className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] pr-3 pl-9 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                      Leave empty to export all matching records.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    Exports the full{" "}
                    {DATASET_OPTIONS.find((item) => item.value === dataset)?.label.toLowerCase()}{" "}
                    dataset with no additional filters.
                  </p>
                )}
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
                {columnOptions.map((option) => {
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
                        <span className="inline-flex items-center gap-1 rounded-sm border border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-1.5 py-0.5 text-[10px] font-medium text-[var(--admin-warning)]">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          Contains learner personal data
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
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
                ).map(([value, label]) => (
                  <label key={value} className="flex cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      name="ru-export-delivery"
                      checked={delivery === value}
                      onChange={() => {
                        setDelivery(value);
                      }}
                      disabled={value !== "download" && !capabilities.canEmailDelivery}
                      className="h-4 w-4 border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)] disabled:opacity-50"
                    />
                    <span className="text-sm text-[var(--admin-on-surface)]">{label}</span>
                  </label>
                ))}
                {delivery === "send_recipients" ? (
                  <div className="space-y-4 border-t border-[var(--admin-border)] pt-4">
                    <div>
                      <label className="mb-2 block text-[12px] text-[var(--admin-on-surface-variant)]">
                        Recipients
                      </label>
                      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] p-2 focus-within:border-[var(--admin-primary)]">
                        {recipients.map((email) => (
                          <span
                            key={email}
                            className="inline-flex items-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 text-xs text-[var(--admin-on-surface)]"
                          >
                            {email}
                            <button
                              type="button"
                              aria-label={`Remove ${email}`}
                              className="ml-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                              onClick={() => {
                                setRecipients((current) =>
                                  current.filter((item) => item !== email),
                                );
                              }}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </span>
                        ))}
                        <input
                          value={recipientInput}
                          onChange={(event) => {
                            setRecipientInput(event.target.value);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addRecipient();
                            }
                          }}
                          onBlur={addRecipient}
                          placeholder="Add email..."
                          className="min-w-[120px] flex-1 border-none bg-transparent p-0 text-sm text-[var(--admin-on-surface)] outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                        Webhook URL (optional)
                      </label>
                      <input
                        type="url"
                        value={webhookUrl}
                        onChange={(event) => {
                          setWebhookUrl(event.target.value);
                        }}
                        placeholder="https://"
                        className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                      />
                    </div>
                  </div>
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
                      placeholder="Monthly usage snapshot"
                      className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-on-surface)]"
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
                      className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-on-surface)]"
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
                      className="h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-on-surface)]"
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
