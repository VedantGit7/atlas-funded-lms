"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Calendar, Info, Search } from "lucide-react";
import {
  resourceUsageExportsApi,
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

const DATASET_OPTIONS: Array<InsightDatasetOption<RuExportDataset>> = [
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

const COLUMNS_BY_DATASET: Record<RuExportDataset, Array<InsightColumnOption<RuExportColumn>>> = {
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

const DATE_PRESET_OPTIONS = [
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["90d", "Last 90 days"],
  ["custom", "Custom range"],
] as const satisfies ReadonlyArray<readonly [RuExportDatePreset, string]>;

function defaultColumnsForDataset(dataset: RuExportDataset): RuExportColumn[] {
  return COLUMNS_BY_DATASET[dataset].map((item) => item.value);
}

function defaultScopeModeForDataset(dataset: RuExportDataset): RuExportScopeMode {
  if (dataset === "metric_history") return "metric";
  if (dataset === "dormant_content" || dataset === "inactive_learners") return "search";
  return "all";
}

function formatEstimate(value: number | null): string {
  if (value == null) return "Row count varies";
  return `Produces ~${value.toLocaleString()} rows`;
}

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
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
  const form = useNewExportForm<RuExportFormat, RuExportDelivery, RuExportCadence>({
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
  const [dataset, setDataset] = useState<RuExportDataset>("meter_snapshot");
  const [scopeMode, setScopeMode] = useState<RuExportScopeMode>("all");
  const [datePreset, setDatePreset] = useState<RuExportDatePreset>("30d");
  const [startedFrom, setStartedFrom] = useState("");
  const [startedTo, setStartedTo] = useState("");
  const [metricKey, setMetricKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [columns, setColumns] = useState<RuExportColumn[]>(
    defaultColumnsForDataset("meter_snapshot"),
  );

  useEffect(() => {
    if (!open) return;
    setDataset("meter_snapshot");
    setScopeMode("all");
    setDatePreset("30d");
    setStartedFrom("");
    setStartedTo("");
    setMetricKey("");
    setSearchQuery("");
    setColumns(defaultColumnsForDataset("meter_snapshot"));
  }, [open]);

  if (!open) return null;

  const columnOptions = COLUMNS_BY_DATASET[dataset];
  const datasetLabel = DATASET_OPTIONS.find((item) => item.value === dataset)?.label;
  const datePresetLabel =
    DATE_PRESET_OPTIONS.find(([value]) => value === datePreset)?.[1] ?? "Last 30 days";
  const datasetEstimate =
    dataset === "meter_snapshot"
      ? formatEstimate(estimates.meterSnapshotRows)
      : dataset === "inactive_learners"
        ? formatEstimate(estimates.inactiveLearnerRows)
        : null;
  const hasPiiSelected = columnOptions.some(
    (option) => option.pii && columns.includes(option.value),
  );

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

  async function onSubmit() {
    if (columns.length === 0) return form.fail("Select at least one column.");
    if (form.delivery === "send_recipients" && form.recipients.length === 0) {
      return form.fail("Add at least one recipient email.");
    }

    const recipients = form.recipients;
    const body: CreateRuExportBody = {
      dataset,
      format: form.format,
      scopeMode,
      datePreset,
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
      webhookUrl:
        form.delivery === "send_recipients" && form.webhookUrl.trim()
          ? form.webhookUrl.trim()
          : undefined,
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
      body.filterSummary = datasetLabel;
    }

    return form.submit(() => resourceUsageExportsApi.create(body), onCreated);
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
          onChange={onDatasetChange}
          columns={3}
          detail={datasetEstimate}
        />
        {dataset === "meter_snapshot" ? (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 text-sm text-[var(--admin-on-surface-variant)]">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]"
              aria-hidden="true"
            />
            <span>{capabilities.unmeteredNote}</span>
          </div>
        ) : null}
      </InsightDialogSection>

      <InsightDialogSection title="Scope">
        <InsightPanel>
          {dataset === "metric_history" ? (
            <div className="flex flex-col gap-4">
              <div>
                <label className={insightFieldLabelClassName}>Metric key</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-2.5 left-3 h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]" />
                  <input
                    type="search"
                    value={metricKey}
                    onChange={(event) => {
                      setMetricKey(event.target.value);
                    }}
                    placeholder="usage.storage_gb"
                    className={`${insightInputClassName} pl-9 font-mono`}
                  />
                </div>
                <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                  Leave empty to export all metrics with history.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <InsightDropdown
                  label="Date preset"
                  value={datePreset}
                  options={DATE_PRESET_OPTIONS}
                  onChange={setDatePreset}
                  icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
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
            </div>
          ) : dataset === "dormant_content" || dataset === "inactive_learners" ? (
            <div>
              <label className={insightFieldLabelClassName}>Search filter</label>
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
                      ? "Search courses by title…"
                      : "Search learners by name or email…"
                  }
                  className={`${insightInputClassName} pl-9`}
                />
              </div>
              <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                Leave empty to export all matching records.
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Exports the full {datasetLabel?.toLowerCase()} dataset with no additional filters.
            </p>
          )}
        </InsightPanel>
      </InsightDialogSection>

      <InsightColumnSection
        groups={[{ options: columnOptions }]}
        selected={columns}
        onToggle={toggleColumn}
        onSelectAll={() => {
          setColumns(columnOptions.map((item) => item.value));
        }}
      >
        {hasPiiSelected ? (
          <p className="flex items-center gap-2 text-[12px] text-[var(--admin-warning)]">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Contains learner personal data
          </p>
        ) : null}
      </InsightColumnSection>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <InsightFormatSection
          formats={capabilities.formats}
          value={form.format}
          onChange={form.setFormat}
        />
        <InsightDeliverySection form={form} emailEnabled={capabilities.canEmailDelivery} webhook />
      </div>

      {capabilities.canSchedule ? (
        <InsightScheduleSection form={form} namePlaceholder="Monthly usage snapshot" />
      ) : null}
    </InsightDialogFrame>
  );
}
