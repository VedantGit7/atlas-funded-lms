"use client";

import { useEffect, useId, useState } from "react";
import { CheckCircle2, Download, Loader2, X } from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  createZoomExport,
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

const selectTriggerClassName =
  "h-11 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const DATASET_OPTIONS: Array<{
  value: ZoomExportDataset;
  label: string;
  description: string;
}> = [
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
  const titleId = useId();
  const [dataset, setDataset] = useState<ZoomExportDataset>("meetings");
  const [format, setFormat] = useState<ZoomExportFormat>("csv");
  const [datePreset, setDatePreset] = useState<ZoomExportDatePreset>("30d");
  const [startedFrom, setStartedFrom] = useState("");
  const [startedTo, setStartedTo] = useState("");
  const [allMeetingsInRange, setAllMeetingsInRange] = useState(true);
  const [delivery, setDelivery] = useState<ZoomExportDelivery>("download");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [cadence, setCadence] = useState<ZoomExportCadence>("weekly");
  const [time, setTime] = useState("09:00");
  const [timezone, setTimezone] = useState("UTC");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDataset("meetings");
    setFormat("csv");
    setDatePreset("30d");
    setStartedFrom("");
    setStartedTo("");
    setAllMeetingsInRange(true);
    setDelivery("download");
    setScheduleEnabled(initialScheduleEnabled);
    setScheduleName("");
    setCadence("weekly");
    setTime("09:00");
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
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

  if (!open) return null;

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateZoomExportBody = {
        dataset,
        format,
        datePreset,
        allMeetingsInRange,
        delivery,
        scheduleEnabled,
        cadence: scheduleEnabled ? cadence : undefined,
        time: scheduleEnabled ? time : undefined,
        timezone: scheduleEnabled ? timezone : undefined,
        scheduleName: scheduleEnabled && scheduleName.trim() ? scheduleName.trim() : undefined,
      };
      if (datePreset === "custom") {
        if (startedFrom) body.startedFrom = new Date(`${startedFrom}T00:00:00.000Z`).toISOString();
        if (startedTo) body.startedTo = new Date(`${startedTo}T23:59:59.999Z`).toISOString();
      }
      const response = await createZoomExport(body);
      onCreated(response.data.run, response.data.schedule);
      onClose();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not create export.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6 py-4">
          <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
            New export
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={submitting}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          {error ? (
            <div
              className="rounded-sm border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <section className="space-y-4">
            <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface)] uppercase">
              Dataset
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {DATASET_OPTIONS.filter((option) => capabilities.datasets.includes(option.value)).map(
                (option) => {
                  const selected = dataset === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setDataset(option.value);
                      }}
                      className={`relative rounded-lg border p-4 text-left transition-colors ${
                        selected
                          ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:bg-[var(--admin-surface-low)]"
                      }`}
                    >
                      <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                        {option.description}
                      </span>
                      {selected ? (
                        <CheckCircle2
                          className="absolute top-4 right-4 h-5 w-5 text-[var(--admin-primary)]"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  );
                },
              )}
            </div>
          </section>

          <section className="space-y-4 border-t border-[var(--admin-border)] pt-6">
            <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface)] uppercase">
              Scope
            </h3>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--admin-on-surface)]">
              <input
                type="checkbox"
                checked={allMeetingsInRange}
                onChange={(event) => {
                  setAllMeetingsInRange(event.target.checked);
                }}
                className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
              />
              All meetings in date range
            </label>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                  Date range
                </label>
                <Select
                  value={datePreset}
                  onValueChange={(value) => {
                    setDatePreset(value as ZoomExportDatePreset);
                  }}
                  options={[
                    { value: "7d", label: "Last 7 days" },
                    { value: "30d", label: "Last 30 days" },
                    { value: "90d", label: "Last 90 days" },
                    { value: "custom", label: "Custom range" },
                  ]}
                  className={selectTriggerClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                  Format
                </label>
                <Select
                  value={format}
                  onValueChange={(value) => {
                    setFormat(value as ZoomExportFormat);
                  }}
                  options={capabilities.formats.map((item) => ({
                    value: item,
                    label: item.toUpperCase(),
                  }))}
                  className={selectTriggerClassName}
                />
              </div>
            </div>
            {datePreset === "custom" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                    From
                  </label>
                  <input
                    type="date"
                    value={startedFrom}
                    onChange={(event) => {
                      setStartedFrom(event.target.value);
                    }}
                    className="h-11 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                    To
                  </label>
                  <input
                    type="date"
                    value={startedTo}
                    onChange={(event) => {
                      setStartedTo(event.target.value);
                    }}
                    className="h-11 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)]"
                  />
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-4 border-t border-[var(--admin-border)] pt-6">
            <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface)] uppercase">
              Delivery
            </h3>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                <input
                  type="radio"
                  name="zoom-export-delivery"
                  checked={delivery === "download"}
                  onChange={() => {
                    setDelivery("download");
                  }}
                  className="border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                />
                Download now
              </label>
              {capabilities.canEmailDelivery ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                  <input
                    type="radio"
                    name="zoom-export-delivery"
                    checked={delivery === "email_me"}
                    onChange={() => {
                      setDelivery("email_me");
                    }}
                    className="border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                  />
                  Email me
                </label>
              ) : null}
            </div>
          </section>

          {capabilities.canSchedule ? (
            <section className="space-y-4 border-t border-[var(--admin-border)] pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface)] uppercase">
                    Schedule
                  </h3>
                  <p className="mt-1 text-[12px] text-[var(--admin-on-surface-variant)]">
                    Optionally create a recurring delivery with this scope.
                  </p>
                </div>
                <PolicyToggle
                  checked={scheduleEnabled}
                  onChange={setScheduleEnabled}
                  label="Enable schedule"
                />
              </div>
              {scheduleEnabled ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                      Schedule name
                    </label>
                    <input
                      type="text"
                      value={scheduleName}
                      onChange={(event) => {
                        setScheduleName(event.target.value);
                      }}
                      placeholder="Weekly Zoom attendance"
                      className="h-11 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                      Cadence
                    </label>
                    <Select
                      value={cadence}
                      onValueChange={(value) => {
                        setCadence(value as ZoomExportCadence);
                      }}
                      options={[
                        { value: "daily", label: "Daily" },
                        { value: "weekly", label: "Weekly" },
                        { value: "monthly", label: "Monthly" },
                      ]}
                      className={selectTriggerClassName}
                    />
                  </div>
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
                      className="h-11 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                      Timezone
                    </label>
                    <input
                      type="text"
                      value={timezone}
                      onChange={(event) => {
                        setTimezone(event.target.value);
                      }}
                      className="h-11 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)]"
                    />
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 rounded-b-lg border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={`${ghostButtonClassName} h-11`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={submitting}
            className={`${primaryButtonClassName} h-11 gap-2`}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            Create export
          </button>
        </div>
      </div>
    </div>
  );
}
