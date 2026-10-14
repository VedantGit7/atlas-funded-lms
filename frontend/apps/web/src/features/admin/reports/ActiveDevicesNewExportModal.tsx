"use client";

import { useEffect, useState } from "react";
import { Select } from "@atlas/design-system";
import {
  activeDevicesExportsApi,
  type CreateDeviceExportBody,
  type DeviceExportCadence,
  type DeviceExportColumn,
  type DeviceExportDelivery,
  type DeviceExportFormat,
  type DeviceExportHistoryItem,
  type DeviceExportScheduleItem,
  type DeviceExportWindow,
} from "./admin-active-devices-exports-api";
import {
  ExportColumnChecklist,
  ExportDeliverySection,
  ExportDialogFrame,
  ExportDialogNote,
  ExportField,
  ExportFiltersSection,
  ExportFormatSection,
  ExportScheduleSection,
  exportSelectTriggerClassName,
} from "./export-dialog-kit";
import { PolicyToggle } from "./report-exports-kit";
import { useNewExportForm } from "./use-new-export-form";

const FORMATS = ["csv", "xlsx", "json"] as const;

const WINDOW_OPTIONS: Array<{ value: DeviceExportWindow; label: string }> = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

const CADENCE_NAMES: Record<DeviceExportCadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export function ActiveDevicesNewExportModal({
  open,
  columns,
  capabilitiesNote,
  initialScheduleEnabled = false,
  onClose,
  onCreated,
}: {
  open: boolean;
  columns: DeviceExportColumn[];
  capabilitiesNote: string;
  /** Opens with scheduling on, for the page's New schedule tile. */
  initialScheduleEnabled?: boolean;
  onClose: () => void;
  onCreated: (run: DeviceExportHistoryItem, schedule: DeviceExportScheduleItem | null) => void;
}) {
  const form = useNewExportForm<DeviceExportFormat, DeviceExportDelivery, DeviceExportCadence>({
    open,
    onClose,
    initialScheduleEnabled,
    defaults: {
      format: "csv",
      delivery: "download",
      cadence: "weekly",
      time: "07:00",
      timezone: "UTC",
    },
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [windowFilter, setWindowFilter] = useState<DeviceExportWindow>("7d");
  const [overLimitOnly, setOverLimitOnly] = useState(true);
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSelected(
      new Set(columns.filter((column) => column.defaultSelected).map((column) => column.key)),
    );
    setWindowFilter("7d");
    setOverLimitOnly(true);
    setUseCurrentFilters(true);
  }, [open, columns]);

  if (!open) return null;

  function toggleColumn(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const windowLabel = WINDOW_OPTIONS.find((option) => option.value === windowFilter)?.label;

  async function onSubmit() {
    if (selected.size === 0) return form.fail("Select at least one column.");
    if (form.delivery === "recipients" && form.recipients.length === 0) {
      return form.fail("Add at least one recipient email.");
    }

    const body: CreateDeviceExportBody = {
      columns: [...selected],
      format: form.format,
      window: windowFilter,
      overLimitOnly: useCurrentFilters ? overLimitOnly : false,
      useCurrentFilters,
      delivery: form.delivery,
      ...(form.delivery === "recipients" ? { recipients: form.recipients } : {}),
      webhookUrl:
        form.delivery === "recipients" && form.webhookUrl.trim() ? form.webhookUrl.trim() : null,
      scheduleEnabled: form.scheduleEnabled,
      ...(form.scheduleEnabled
        ? {
            scheduleName: `${CADENCE_NAMES[form.cadence]} device audit`,
            cadence: form.cadence,
            time: form.time,
            timezone: form.timezone,
          }
        : {}),
    };

    return form.submit(() => activeDevicesExportsApi.create(body), onCreated);
  }

  return (
    <ExportDialogFrame
      saving={form.saving}
      error={form.error}
      onClose={onClose}
      onSubmit={() => void onSubmit()}
    >
      <ExportColumnChecklist
        columns={columns}
        selected={selected}
        onToggle={toggleColumn}
        onSelectAll={() => {
          setSelected(new Set(columns.map((column) => column.key)));
        }}
        badgeFor={(key) =>
          columns.find((column) => column.key === key)?.sensitive ? "sensitive" : null
        }
      />

      <ExportFiltersSection
        summary={`Status: ${overLimitOnly ? "Over limit" : "All"} · Range: ${windowLabel ?? "All time"}`}
        useCurrentFilters={useCurrentFilters}
        onUseCurrentFiltersChange={setUseCurrentFilters}
      >
        {useCurrentFilters ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ExportField label="Window">
              <Select
                value={windowFilter}
                onValueChange={(value) => {
                  setWindowFilter(value as DeviceExportWindow);
                }}
                options={WINDOW_OPTIONS}
                className={exportSelectTriggerClassName}
              />
            </ExportField>
            <label className="flex items-center justify-between gap-3 self-end rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2">
              <span className="text-sm text-[var(--admin-on-surface)]">Over device limit only</span>
              <PolicyToggle
                checked={overLimitOnly}
                onChange={setOverLimitOnly}
                label="Over device limit only"
              />
            </label>
          </div>
        ) : null}
      </ExportFiltersSection>

      <ExportFormatSection formats={FORMATS} value={form.format} onChange={form.setFormat} />

      <ExportDeliverySection form={form} webhook />

      <ExportScheduleSection form={form} />

      <ExportDialogNote>{capabilitiesNote}</ExportDialogNote>
    </ExportDialogFrame>
  );
}
