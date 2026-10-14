"use client";

import { useEffect, useState } from "react";
import {
  zoomInsightsExportsApi,
  type CreateZoomExportBody,
  type ZoomExportCadence,
  type ZoomExportDataset,
  type ZoomExportDatePreset,
  type ZoomExportDelivery,
  type ZoomExportFormat,
  type ZoomExportHistoryItem,
  type ZoomExportScheduleItem,
  type ZoomInsightsExportsPayload,
} from "./admin-zoom-insights-exports-api";
import {
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
  type InsightDatasetOption,
} from "./insight-export-dialog-kit";
import { useNewExportForm } from "./use-new-export-form";

const DATASET_OPTIONS: Array<InsightDatasetOption<ZoomExportDataset>> = [
  {
    value: "meetings",
    label: "Meetings",
    description: "One row per meeting. Summary metrics only.",
  },
  {
    value: "participants",
    label: "Participants",
    description: "One row per person per meeting.",
  },
  {
    value: "unmatched",
    label: "Unmatched",
    description: "Participants without a linked membership.",
  },
  {
    value: "connection",
    label: "Connection",
    description: "Sync run audit trail for the Zoom connection.",
  },
];

const DATE_PRESET_OPTIONS = [
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["90d", "Last 90 days"],
  ["custom", "Custom range"],
] as const satisfies ReadonlyArray<readonly [ZoomExportDatePreset, string]>;

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function ZoomInsightsNewExportModal({
  open,
  capabilities,
  initialScheduleEnabled,
  onClose,
  onCreated,
}: {
  open: boolean;
  capabilities: ZoomInsightsExportsPayload["capabilities"];
  initialScheduleEnabled: boolean;
  onClose: () => void;
  onCreated: (run: ZoomExportHistoryItem, schedule: ZoomExportScheduleItem | null) => void;
}) {
  const form = useNewExportForm<ZoomExportFormat, ZoomExportDelivery, ZoomExportCadence>({
    open,
    onClose,
    initialScheduleEnabled,
    defaults: {
      format: "csv",
      delivery: "download",
      cadence: "weekly",
      time: "09:00",
      timezone: browserTimezone,
    },
  });
  const [dataset, setDataset] = useState<ZoomExportDataset>("meetings");
  const [datePreset, setDatePreset] = useState<ZoomExportDatePreset>("30d");
  const [startedFrom, setStartedFrom] = useState("");
  const [startedTo, setStartedTo] = useState("");
  const [allMeetingsInRange, setAllMeetingsInRange] = useState(true);

  useEffect(() => {
    if (!open) return;
    setDataset("meetings");
    setDatePreset("30d");
    setStartedFrom("");
    setStartedTo("");
    setAllMeetingsInRange(true);
  }, [open]);

  if (!open) return null;

  async function onSubmit() {
    const body: CreateZoomExportBody = {
      dataset,
      format: form.format,
      datePreset,
      allMeetingsInRange,
      delivery: form.delivery,
      scheduleEnabled: form.scheduleEnabled,
      cadence: form.scheduleEnabled ? form.cadence : undefined,
      time: form.scheduleEnabled ? form.time : undefined,
      timezone: form.scheduleEnabled ? form.timezone : undefined,
      scheduleName:
        form.scheduleEnabled && form.scheduleName.trim() ? form.scheduleName.trim() : undefined,
    };
    if (datePreset === "custom") {
      if (startedFrom) body.startedFrom = new Date(`${startedFrom}T00:00:00.000Z`).toISOString();
      if (startedTo) body.startedTo = new Date(`${startedTo}T23:59:59.999Z`).toISOString();
    }
    return form.submit(() => zoomInsightsExportsApi.create(body), onCreated);
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
          options={DATASET_OPTIONS.filter((option) => capabilities.datasets.includes(option.value))}
          value={dataset}
          onChange={setDataset}
          columns={4}
        />
      </InsightDialogSection>

      <InsightDialogSection title="Scope">
        <InsightPanel>
          <div className="flex flex-col gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--admin-on-surface)]">
              <input
                type="checkbox"
                checked={allMeetingsInRange}
                onChange={(event) => {
                  setAllMeetingsInRange(event.target.checked);
                }}
                className={insightCheckboxClassName}
              />
              All meetings in date range
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <InsightDropdown
                label="Date range"
                value={datePreset}
                options={DATE_PRESET_OPTIONS}
                onChange={setDatePreset}
              />
              {datePreset === "custom" ? (
                <>
                  <div>
                    <label className={insightFieldLabelClassName}>From</label>
                    <input
                      type="date"
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
                      type="date"
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
        </InsightPanel>
      </InsightDialogSection>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <InsightFormatSection
          formats={capabilities.formats}
          value={form.format}
          onChange={form.setFormat}
        />
        <InsightDeliverySection
          form={form}
          emailEnabled={capabilities.canEmailDelivery}
          recipients={false}
        />
      </div>

      {capabilities.canSchedule ? (
        <InsightScheduleSection form={form} namePlaceholder="Weekly Zoom attendance" />
      ) : null}
    </InsightDialogFrame>
  );
}
