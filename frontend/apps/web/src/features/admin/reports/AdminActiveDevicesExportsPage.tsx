"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  Mail,
  MoreVertical,
  Plus,
  RefreshCw,
  Trash2,
  Webhook,
  X,
} from "lucide-react";
import { Select, dropdownPanelEnterEndClassName } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import { ActiveDevicesReportTabs } from "./ActiveDevicesReportTabs";
import {
  createDeviceExport,
  deleteDeviceExportSchedule,
  downloadDeviceExport,
  fetchDeviceExportRun,
  fetchDeviceExports,
  retryDeviceExport,
  updateDeviceExportSchedule,
  type CreateDeviceExportBody,
  type DeviceExportCadence,
  type DeviceExportColumn,
  type DeviceExportDelivery,
  type DeviceExportFormat,
  type DeviceExportHistoryItem,
  type DeviceExportScheduleItem,
  type DeviceExportWindow,
  type DeviceExportsPayload,
} from "./admin-active-devices-exports-api";

const selectTriggerClassName =
  "h-10 w-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

function formatRelative(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${String(mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${String(hours)}h ago`;
  return `${String(Math.floor(hours / 24))}d ago`;
}

function formatUtc(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "Z");
}

function statusChip(status: DeviceExportHistoryItem["status"]) {
  if (status === "SUCCEEDED") {
    return "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]";
  }
  if (status === "FAILED" || status === "CANCELLED") {
    return "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface)] animate-pulse";
}

function statusLabel(status: DeviceExportHistoryItem["status"]) {
  if (status === "SUCCEEDED") return "Ready";
  if (status === "RUNNING") return "Building";
  if (status === "QUEUED") return "Queued";
  if (status === "FAILED") return "Failed";
  return "Cancelled";
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

function FailureModal({
  item,
  onClose,
  onRetry,
  busy,
}: {
  item: DeviceExportHistoryItem;
  onClose: () => void;
  onRetry: () => void;
  busy: boolean;
}) {
  const titleId = useId();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]"
      >
        <div className="flex items-start gap-4 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] text-[var(--admin-danger)]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              Export failed
            </h2>
            <p className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
              {item.fileName}
            </p>
          </div>
        </div>
        <div className="p-6">
          <p className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
            Error reason
          </p>
          <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 font-mono text-[13px] break-words text-[var(--admin-on-surface)]">
            {item.errorMessage ?? item.errorCode ?? "Unknown export failure."}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6">
          <button type="button" onClick={onClose} className={`${ghostButtonClassName} h-10`}>
            Close
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className={`${primaryButtonClassName} h-10 gap-2`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Retry export
          </button>
        </div>
      </div>
    </div>
  );
}

function NewExportModal({
  open,
  columns,
  capabilitiesNote,
  onClose,
  onCreated,
}: {
  open: boolean;
  columns: DeviceExportColumn[];
  capabilitiesNote: string;
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
    setScheduleEnabled(false);
    setCadence("weekly");
    setTime("07:00");
    setTimezone("UTC");
    setError(null);
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
      const response = await createDeviceExport(body);
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

export function AdminActiveDevicesExportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DeviceExportsPayload | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [failureItem, setFailureItem] = useState<DeviceExportHistoryItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastRun, setToastRun] = useState<DeviceExportHistoryItem | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const applyPayload = useCallback((next: DeviceExportsPayload) => {
    setPayload(next);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchDeviceExports();
      applyPayload(response.data);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not load exports.");
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  const buildingIds = useMemo(
    () =>
      (payload?.history ?? [])
        .filter((item) => item.status === "QUEUED" || item.status === "RUNNING")
        .map((item) => item.id),
    [payload],
  );

  useEffect(() => {
    if (buildingIds.length === 0) return;
    const timer = window.setInterval(() => {
      void (async () => {
        for (const id of buildingIds) {
          try {
            const response = await fetchDeviceExportRun(id);
            setPayload((current) => {
              if (!current) return current;
              const history = current.history.map((item) =>
                item.id === id ? response.data : item,
              );
              return { ...current, history };
            });
            if (response.data.status === "SUCCEEDED") {
              setToastRun(response.data);
            }
          } catch {
            // keep polling
          }
        }
      })();
    }, 2000);
    return () => {
      window.clearInterval(timer);
    };
  }, [buildingIds]);

  async function onDownload(item: DeviceExportHistoryItem) {
    setBusyId(item.id);
    try {
      await downloadDeviceExport(item);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not download export.");
    } finally {
      setBusyId(null);
    }
  }

  async function onRetry(item: DeviceExportHistoryItem) {
    setBusyId(item.id);
    try {
      const response = await retryDeviceExport(item.id);
      setPayload((current) =>
        current
          ? {
              ...current,
              history: [response.data, ...current.history.filter((row) => row.id !== item.id)],
            }
          : current,
      );
      setFailureItem(null);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not retry export.");
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleSchedule(schedule: DeviceExportScheduleItem) {
    setBusyId(schedule.id);
    try {
      const response = await updateDeviceExportSchedule(schedule.id, {
        isActive: !schedule.isActive,
      });
      setPayload((current) =>
        current
          ? {
              ...current,
              schedules: current.schedules.map((item) =>
                item.id === schedule.id ? response.data : item,
              ),
            }
          : current,
      );
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not update schedule.");
    } finally {
      setBusyId(null);
      setMenuOpenId(null);
    }
  }

  async function onDeleteSchedule(schedule: DeviceExportScheduleItem) {
    setBusyId(schedule.id);
    try {
      await deleteDeviceExportSchedule(schedule.id);
      setPayload((current) =>
        current
          ? {
              ...current,
              schedules: current.schedules.filter((item) => item.id !== schedule.id),
            }
          : current,
      );
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not delete schedule.");
    } finally {
      setBusyId(null);
      setMenuOpenId(null);
    }
  }

  if (loading || !payload) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--admin-surface-high)]" />
        <div className="h-10 w-full animate-pulse rounded bg-[var(--admin-surface-high)]" />
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="h-80 animate-pulse rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-7" />
          <div className="h-80 animate-pulse rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-5" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <nav className="mb-2 flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
            <Link href="/admin" className="hover:text-[var(--admin-primary)]">
              Admin
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              href="/admin/reports/active-devices"
              className="hover:text-[var(--admin-primary)]"
            >
              Active Devices
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-[var(--admin-on-surface)]">Exports</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Exports
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            Download the device roster or schedule recurring delivery to your security team.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className={`${ghostButtonClassName} h-10 gap-2`}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setModalOpen(true);
            }}
            className={`${primaryButtonClassName} h-10 gap-2`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New export
          </button>
        </div>
      </div>

      <ActiveDevicesReportTabs active="exports" />

      {error ? (
        <div
          className="rounded border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="flex flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-7">
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              Export history
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <tr>
                  {["File", "Scope", "Rows", "Size", "Created", "Status", "Action"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className={`h-11 px-4 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase ${
                          heading === "Rows" || heading === "Size" || heading === "Action"
                            ? "text-right"
                            : ""
                        }`}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {payload.history.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-[var(--admin-on-surface-variant)]"
                    >
                      No exports yet. Create one to download the device roster.
                    </td>
                  </tr>
                ) : (
                  payload.history.map((item) => {
                    const building = item.status === "QUEUED" || item.status === "RUNNING";
                    return (
                      <tr
                        key={item.id}
                        className="group relative h-11 transition-colors hover:bg-[var(--admin-surface-low)]"
                      >
                        <td className="px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                              {item.fileName.replace(/\.(csv|xlsx|json|pdf)$/i, "")}
                            </span>
                            <span className="inline-flex h-6 items-center rounded bg-[var(--admin-surface-high)] px-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)] uppercase">
                              {item.format}
                            </span>
                          </div>
                          {building ? (
                            <div className="absolute bottom-0 left-0 h-0.5 w-2/5 bg-[var(--admin-primary)]" />
                          ) : null}
                        </td>
                        <td className="max-w-[150px] truncate px-4 text-sm text-[var(--admin-on-surface-variant)]">
                          {item.scopeLabel}
                        </td>
                        <td className="px-4 text-right font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                          {item.rowCount == null ? "-" : item.rowCount.toLocaleString()}
                        </td>
                        <td className="px-4 text-right font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                          {item.sizeLabel ?? "-"}
                        </td>
                        <td className="px-4 whitespace-nowrap">
                          <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {formatRelative(item.createdAt)}
                          </div>
                          <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {formatUtc(item.createdAt)}
                          </div>
                        </td>
                        <td className="px-4">
                          <button
                            type="button"
                            className={`inline-flex h-6 items-center rounded px-2 text-xs font-medium ${statusChip(item.status)}`}
                            onClick={() => {
                              if (item.status === "FAILED") setFailureItem(item);
                            }}
                          >
                            {statusLabel(item.status)}
                          </button>
                        </td>
                        <td className="px-4 text-right">
                          {building ? (
                            <Loader2
                              className="ml-auto h-4 w-4 animate-spin text-[var(--admin-outline)]"
                              aria-hidden="true"
                            />
                          ) : item.status === "SUCCEEDED" ? (
                            <button
                              type="button"
                              onClick={() => void onDownload(item)}
                              disabled={busyId === item.id}
                              className="text-sm font-semibold text-[var(--admin-primary)] opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-80"
                            >
                              Download
                            </button>
                          ) : item.status === "FAILED" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setFailureItem(item);
                              }}
                              className="text-sm font-semibold text-[var(--admin-danger)] opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              Details
                            </button>
                          ) : (
                            <span className="text-sm text-[var(--admin-on-surface-variant)]">
                              -
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-4 lg:col-span-5">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Scheduled exports
          </h2>
          {payload.schedules.length === 0 ? (
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                No scheduled exports yet. Enable scheduling when creating an export.
              </p>
            </div>
          ) : (
            payload.schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    {schedule.name}
                  </h3>
                  <div className="relative flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Schedule actions"
                      onClick={() => {
                        setMenuOpenId((current) => (current === schedule.id ? null : schedule.id));
                      }}
                      className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                    >
                      <MoreVertical className="h-5 w-5" aria-hidden="true" />
                    </button>
                    {menuOpenId === schedule.id ? (
                      <div
                        className={`absolute top-8 right-0 z-20 min-w-[140px] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg ${dropdownPanelEnterEndClassName}`}
                      >
                        <button
                          type="button"
                          onClick={() => void onDeleteSchedule(schedule)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--admin-danger)] hover:bg-[var(--admin-surface-low)]"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    ) : null}
                    <PolicyToggle
                      checked={schedule.isActive}
                      disabled={busyId === schedule.id}
                      onChange={() => void onToggleSchedule(schedule)}
                      label={`Toggle ${schedule.name}`}
                    />
                  </div>
                </div>
                <p className="mb-4 text-sm text-[var(--admin-on-surface-variant)]">
                  {schedule.cadenceLabel}
                </p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {schedule.recipients.map((email) => (
                    <span
                      key={email}
                      className="inline-flex h-6 items-center gap-1 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]"
                    >
                      <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                      {email}
                    </span>
                  ))}
                  {schedule.webhookLabel ? (
                    <span className="inline-flex h-6 items-center gap-1 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                      <Webhook className="h-3.5 w-3.5" aria-hidden="true" />
                      {schedule.webhookLabel}
                    </span>
                  ) : null}
                  {schedule.formats.map((format) => (
                    <span
                      key={format}
                      className="inline-flex h-6 items-center rounded bg-[var(--admin-surface-high)] px-2 font-mono text-[11px] text-[var(--admin-on-surface)] uppercase"
                    >
                      {format}
                    </span>
                  ))}
                </div>
                <p className="font-mono text-[11px] text-[var(--admin-primary)]">
                  {schedule.nextRunLabel}
                </p>
              </div>
            ))
          )}
        </section>
      </div>

      <NewExportModal
        open={modalOpen}
        columns={payload.columns}
        capabilitiesNote={payload.capabilities.note}
        onClose={() => {
          setModalOpen(false);
        }}
        onCreated={(run, schedule) => {
          setPayload((current) =>
            current
              ? {
                  ...current,
                  history: [run, ...current.history],
                  schedules: schedule ? [schedule, ...current.schedules] : current.schedules,
                }
              : current,
          );
          if (run.status === "SUCCEEDED") setToastRun(run);
        }}
      />

      {failureItem ? (
        <FailureModal
          item={failureItem}
          busy={busyId === failureItem.id}
          onClose={() => {
            setFailureItem(null);
          }}
          onRetry={() => void onRetry(failureItem)}
        />
      ) : null}

      {toastRun ? (
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-4 rounded-lg bg-[var(--admin-inverse-surface,var(--admin-on-surface))] px-4 py-3 text-[var(--admin-inverse-on-surface,var(--admin-surface))] shadow-lg">
          <CheckCircle2 className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
          <span className="text-sm">
            <span className="font-mono text-[13px]">{toastRun.fileName}</span> is ready
          </span>
          <button
            type="button"
            className="text-sm font-semibold text-[var(--admin-primary)]"
            onClick={() => void onDownload(toastRun)}
          >
            Download
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setToastRun(null);
            }}
            className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-surface)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
