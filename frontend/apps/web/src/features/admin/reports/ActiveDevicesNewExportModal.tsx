"use client";

import { useEffect, useId, useState } from "react";
import { AlertTriangle, Download, Info, Loader2, X } from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
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
import { PolicyToggle } from "./report-exports-kit";

const selectTriggerClassName =
  "h-10 w-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

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
  const titleId = useId();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<DeviceExportFormat>("csv");
  const [windowFilter, setWindowFilter] = useState<DeviceExportWindow>("7d");
  const [overLimitOnly, setOverLimitOnly] = useState(true);
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);
  const [delivery, setDelivery] = useState<DeviceExportDelivery>("download");
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [cadence, setCadence] = useState<DeviceExportCadence>("weekly");
  const [time, setTime] = useState("07:00");
  const [timezone, setTimezone] = useState("UTC");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(
      new Set(columns.filter((column) => column.defaultSelected).map((column) => column.key)),
    );
    setFormat("csv");
    setWindowFilter("7d");
    setOverLimitOnly(true);
    setUseCurrentFilters(true);
    setDelivery("download");
    setRecipientInput("");
    setRecipients([]);
    setWebhookUrl("");
    setScheduleEnabled(initialScheduleEnabled);
    setCadence("weekly");
    setTime("07:00");
    setTimezone("UTC");
    setError(null);
  }, [open, columns, initialScheduleEnabled]);

  if (!open) return null;

  function toggleColumn(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addRecipient() {
    const email = recipientInput.trim();
    if (!email || !email.includes("@")) return;
    setRecipients((current) => (current.includes(email) ? current : [...current, email]));
    setRecipientInput("");
  }

  async function onSubmit() {
    if (selected.size === 0) {
      setError("Select at least one column.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: CreateDeviceExportBody = {
        columns: [...selected],
        format,
        window: windowFilter,
        overLimitOnly: useCurrentFilters ? overLimitOnly : false,
        useCurrentFilters,
        delivery,
        ...(delivery === "recipients" ? { recipients } : {}),
        webhookUrl: delivery === "recipients" && webhookUrl.trim() ? webhookUrl.trim() : null,
        scheduleEnabled,
        ...(scheduleEnabled ? { scheduleName: "Weekly device audit" } : {}),
        ...(scheduleEnabled ? { cadence } : {}),
        ...(scheduleEnabled ? { time } : {}),
        ...(scheduleEnabled ? { timezone } : {}),
      };
      const response = await activeDevicesExportsApi.create(body);
      onCreated(response.data.run, response.data.schedule);
      onClose();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not create export.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-[800px] flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)]"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6">
          <h2
            id={titleId}
            className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]"
          >
            New export
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Columns</h3>
              <button
                type="button"
                className="text-sm text-[var(--admin-primary)] hover:underline"
                onClick={() => {
                  setSelected(new Set(columns.map((column) => column.key)));
                }}
              >
                Select all
              </button>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 sm:grid-cols-2">
              {columns.map((column) => (
                <label
                  key={column.key}
                  className="group flex cursor-pointer items-start justify-between gap-3"
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(column.key)}
                      onChange={() => {
                        toggleColumn(column.key);
                      }}
                      className="h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                    />
                    <span className="text-sm text-[var(--admin-on-surface)] group-hover:text-[var(--admin-primary)]">
                      {column.label}
                    </span>
                  </span>
                  {column.sensitive ? (
                    <span className="inline-flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--admin-danger)] uppercase">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      Sensitive
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Filters</h3>
            <div className="flex flex-col gap-4 border border-[var(--admin-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                  <span className="text-[var(--admin-on-surface-variant)]">Status:</span>{" "}
                  {overLimitOnly ? "Over limit" : "All"}
                  <span className="mx-2 text-[var(--admin-border)]">|</span>
                  <span className="text-[var(--admin-on-surface-variant)]">Range:</span>{" "}
                  {windowFilter === "24h"
                    ? "Last 24h"
                    : windowFilter === "7d"
                      ? "Last 7 days"
                      : windowFilter === "30d"
                        ? "Last 30 days"
                        : "All time"}
                </div>
                <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Export will be scoped to these filters.
                </p>
              </div>
              <label className="flex items-center gap-3">
                <span className="text-sm text-[var(--admin-on-surface)]">Use current filters</span>
                <PolicyToggle
                  checked={useCurrentFilters}
                  onChange={setUseCurrentFilters}
                  label="Use current filters"
                />
              </label>
            </div>
            {useCurrentFilters ? (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Window
                  </span>
                  <Select
                    value={windowFilter}
                    onValueChange={(value) => {
                      setWindowFilter(value as DeviceExportWindow);
                    }}
                    options={[
                      { value: "24h", label: "Last 24 hours" },
                      { value: "7d", label: "Last 7 days" },
                      { value: "30d", label: "Last 30 days" },
                      { value: "all", label: "All time" },
                    ]}
                    className={selectTriggerClassName}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2">
                  <span className="text-sm text-[var(--admin-on-surface)]">
                    Over device limit only
                  </span>
                  <PolicyToggle
                    checked={overLimitOnly}
                    onChange={setOverLimitOnly}
                    label="Over device limit only"
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Format</h3>
            <div className="inline-flex rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1">
              {(["csv", "xlsx", "json"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFormat(value);
                  }}
                  className={`rounded px-6 py-2 text-[12px] font-semibold tracking-[0.06em] uppercase transition-all ${
                    format === value
                      ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                      : "text-[var(--admin-on-surface-variant)]"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
              Delivery
            </h3>
            <div className="space-y-3">
              {(
                [
                  ["download", "Download now"],
                  ["email_me", "Email me when ready"],
                  ["recipients", "Send to recipients"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="delivery"
                    checked={delivery === value}
                    onChange={() => {
                      setDelivery(value);
                    }}
                    className="h-4 w-4 border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                  />
                  <span className="text-sm text-[var(--admin-on-surface)]">{label}</span>
                </label>
              ))}
              {delivery === "recipients" ? (
                <div className="space-y-4 pt-2 pl-7">
                  <div>
                    <label className="mb-2 block text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Recipients
                    </label>
                    <div className="flex min-h-10 flex-wrap items-center gap-2 border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2 focus-within:border-[var(--admin-primary)]">
                      {recipients.map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 text-xs text-[var(--admin-on-surface)]"
                        >
                          {email}
                          <button
                            type="button"
                            className="ml-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                            onClick={() => {
                              setRecipients((current) => current.filter((item) => item !== email));
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
                    <label className="mb-2 block text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Webhook URL (Optional)
                    </label>
                    <input
                      value={webhookUrl}
                      onChange={(event) => {
                        setWebhookUrl(event.target.value);
                      }}
                      placeholder="https://"
                      className="h-10 w-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Schedule</h3>
              <label className="flex items-center gap-3">
                <span className="text-sm text-[var(--admin-on-surface-variant)]">
                  Schedule this export
                </span>
                <PolicyToggle
                  checked={scheduleEnabled}
                  onChange={setScheduleEnabled}
                  label="Schedule this export"
                />
              </label>
            </div>
            {scheduleEnabled ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Cadence
                  </span>
                  <Select
                    value={cadence}
                    onValueChange={(value) => {
                      setCadence(value as DeviceExportCadence);
                    }}
                    options={[
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                    ]}
                    className={selectTriggerClassName}
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Time
                  </span>
                  <input
                    type="time"
                    value={time}
                    onChange={(event) => {
                      setTime(event.target.value);
                    }}
                    className="h-10 border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Timezone
                  </span>
                  <Select
                    value={timezone}
                    onValueChange={setTimezone}
                    options={[
                      { value: "UTC", label: "UTC" },
                      { value: "Asia/Kolkata", label: "Asia/Kolkata" },
                      { value: "America/New_York", label: "America/New_York" },
                      { value: "America/Los_Angeles", label: "America/Los_Angeles" },
                      { value: "Europe/London", label: "Europe/London" },
                    ]}
                    className={selectTriggerClassName}
                  />
                </label>
              </div>
            ) : null}
          </section>

          <div className="flex items-start gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]"
              aria-hidden="true"
            />
            <span>{capabilitiesNote}</span>
          </div>

          {error ? (
            <p className="text-sm text-[var(--admin-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex h-[72px] shrink-0 items-center justify-end gap-4 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6">
          <button type="button" onClick={onClose} className={`${ghostButtonClassName} h-10`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={saving}
            className={`${primaryButtonClassName} h-10 gap-2`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            Create export
          </button>
        </footer>
      </div>
    </div>
  );
}
