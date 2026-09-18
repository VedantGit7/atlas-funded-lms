"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  Webhook,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  createPaymentExport,
  deletePaymentExportSchedule,
  downloadPaymentExport,
  fetchPaymentExportRun,
  fetchPaymentExports,
  retryPaymentExport,
  updatePaymentExportSchedule,
  type CreatePaymentExportBody,
  type PaymentExportCadence,
  type PaymentExportColumn,
  type PaymentExportDataset,
  type PaymentExportDelivery,
  type PaymentExportFormat,
  type PaymentExportGrouping,
  type PaymentExportHistoryItem,
  type PaymentExportScheduleItem,
  type PaymentExportsPayload,
} from "./admin-payments-exports-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  fetchPaymentGateways,
  type PaymentGatewayItem,
} from "./admin-payments-roster-api";
import { PaymentsReportTabs } from "./PaymentsReportTabs";

const selectTriggerClassName =
  "h-10 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const DATASET_OPTIONS: Array<{ value: PaymentExportDataset; label: string }> = [
  { value: "transactions", label: "Transactions" },
  { value: "orders", label: "Orders" },
  { value: "invoices", label: "Invoices" },
  { value: "instalments", label: "Instalments" },
  { value: "refunds", label: "Refunds" },
  { value: "gateways", label: "Gateway transactions" },
];

const GROUPING_OPTIONS: Array<{ value: PaymentExportGrouping; label: string }> = [
  { value: "none", label: "None" },
  { value: "gateway", label: "By gateway" },
  { value: "product", label: "By product" },
  { value: "currency", label: "By currency" },
  { value: "month", label: "By month" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const SETTLEMENT_OPTIONS = [
  { value: "", label: "Settled and unsettled" },
  { value: "settled", label: "Settled only" },
  { value: "unsettled", label: "Unsettled only" },
];

const SENSITIVE_COLUMN_KEYS = new Set(["amount_cents", "tax_amount_cents", "coupon_amount_cents"]);

function formatRelative(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatUtc(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "Z");
}

function datasetChipClassName(dataset: PaymentExportDataset): string {
  if (dataset === "refunds") {
    return "bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (dataset === "gateways") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
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

function DeterminateProgressBar({ percent }: { percent: number | null }) {
  const value = percent == null ? null : Math.min(100, Math.max(0, percent));
  if (value == null) {
    return (
      <div
        className="mt-2 h-0.5 w-full overflow-hidden rounded-sm bg-[var(--admin-surface-high)]"
        role="progressbar"
        aria-valuetext="Building export"
      >
        <div className="h-full w-full animate-pulse bg-[var(--admin-primary)]" />
      </div>
    );
  }
  return (
    <div
      className="mt-2 h-0.5 w-full overflow-hidden rounded-sm bg-[var(--admin-surface-high)]"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Export ${value}% complete`}
    >
      <div
        className="h-full bg-[var(--admin-primary)] transition-[width] duration-300 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function FailureDrawer({
  item,
  onClose,
  onRetry,
  busy,
}: {
  item: PaymentExportHistoryItem;
  onClose: () => void;
  onRetry: () => void;
  busy: boolean;
}) {
  const titleId = useId();
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-md flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
      >
        <div className="flex items-start gap-4 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] text-[var(--admin-danger)]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              Export failed
            </h2>
            <p className="mt-1 truncate font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
              {item.fileName}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <p className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
              Error reason
            </p>
            <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 font-mono text-[13px] break-words text-[var(--admin-on-surface)]">
              {item.errorMessage ?? item.errorCode ?? "Unknown export failure."}
            </div>
          </div>

          {item.errorTrace && item.errorTrace.length > 0 ? (
            <div>
              <p className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                Execution trace
              </p>
              <pre className="max-h-56 overflow-auto rounded-sm border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-on-surface)_92%,black)] p-4 font-mono text-[11px] leading-relaxed text-[color-mix(in_srgb,#7CFC9A_70%,white)]">
                {item.errorTrace.join("\n")}
              </pre>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
              Configuration
            </p>
            <dl className="space-y-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--admin-on-surface-variant)]">Dataset</dt>
                <dd className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {item.datasetLabel}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--admin-on-surface-variant)]">Scope</dt>
                <dd className="max-w-[200px] truncate text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {item.scopeLabel}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--admin-on-surface-variant)]">Format</dt>
                <dd className="font-mono text-[13px] uppercase text-[var(--admin-on-surface)]">
                  {item.format}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-[var(--admin-on-surface-variant)]">Columns</dt>
                <dd className="font-mono text-[12px] leading-relaxed break-words text-[var(--admin-on-surface)]">
                  {item.columns.length > 0 ? item.columns.join(", ") : "—"}
                </dd>
              </div>
            </dl>
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
  capabilities,
  gateways,
  gatewaysLoading,
  initialScheduleEnabled,
  onClose,
  onCreated,
}: {
  open: boolean;
  columns: PaymentExportColumn[];
  capabilities: PaymentExportsPayload["capabilities"];
  gateways: PaymentGatewayItem[];
  gatewaysLoading: boolean;
  initialScheduleEnabled: boolean;
  onClose: () => void;
  onCreated: (run: PaymentExportHistoryItem, schedule: PaymentExportScheduleItem | null) => void;
}) {
  const titleId = useId();
  const [dataset, setDataset] = useState<PaymentExportDataset>("transactions");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<PaymentExportFormat>("csv");
  const [paidFrom, setPaidFrom] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [gatewayKey, setGatewayKey] = useState("");
  const [status, setStatus] = useState("");
  const [settlement, setSettlement] = useState("");
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);
  const [grouping, setGrouping] = useState<PaymentExportGrouping>("none");
  const [includeSubtotals, setIncludeSubtotals] = useState(false);
  const [delivery, setDelivery] = useState<PaymentExportDelivery>("download");
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [cadence, setCadence] = useState<PaymentExportCadence>("monthly");
  const [time, setTime] = useState("06:00");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDataset("transactions");
    setSelected(
      new Set(columns.filter((column) => column.defaultSelected).map((column) => column.key)),
    );
    setFormat("csv");
    setPaidFrom("");
    setPaidTo("");
    setGatewayKey("");
    setStatus("");
    setUseCurrentFilters(true);
    setGrouping("none");
    setIncludeSubtotals(false);
    setDelivery("download");
    setRecipientInput("");
    setRecipients([]);
    setWebhookUrl("");
    setScheduleEnabled(initialScheduleEnabled);
    setCadence("monthly");
    setTime("06:00");
    setTimezone("Asia/Kolkata");
    setError(null);
  }, [open, columns, initialScheduleEnabled]);

  if (!open) return null;

  const hasSensitiveSelected = [...selected].some((key) => SENSITIVE_COLUMN_KEYS.has(key));

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

  function filterSummary(): string {
    const parts: string[] = [];
    if (dataset === "gateways" && gatewayKey) {
      const gateway = gateways.find((item) => item.gatewayKey === gatewayKey);
      parts.push(gateway?.displayName ?? gatewayKey);
    } else {
      parts.push("All sources");
    }
    if (status.trim()) parts.push(status.trim());
    if (dataset === "orders" && settlement) {
      parts.push(settlement === "settled" ? "Settled only" : "Unsettled only");
    }
    if (paidFrom && paidTo) parts.push(`${paidFrom} – ${paidTo}`);
    else if (paidFrom) parts.push(`From ${paidFrom}`);
    else if (paidTo) parts.push(`Until ${paidTo}`);
    else parts.push("All time");
    return parts.join(" · ");
  }

  async function onSubmit() {
    if (selected.size === 0) {
      setError("Select at least one column.");
      return;
    }
    if (dataset === "gateways" && !gatewayKey.trim()) {
      setError("Select a gateway for gateway transaction exports.");
      return;
    }
    if (delivery === "recipients" && recipients.length === 0) {
      setError("Add at least one recipient email.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body: CreatePaymentExportBody = {
        dataset,
        columns: [...selected],
        format,
        useCurrentFilters,
        grouping,
        includeSubtotals,
        delivery,
        scheduleEnabled,
      };

      if (useCurrentFilters) {
        const fromIso = dateInputToStartIso(paidFrom);
        const toIso = dateInputToEndIso(paidTo);
        if (fromIso) body.paidFrom = fromIso;
        if (toIso) body.paidTo = toIso;
        if (dataset === "gateways" && gatewayKey.trim()) body.gatewayKey = gatewayKey.trim();
        if (status.trim()) body.status = status.trim();
        // Sent only where it is honoured. The server refuses it on the other
        // datasets rather than dropping it, so sending it anywhere else would
        // turn an ignored control into a failed export.
        if (dataset === "orders" && (settlement === "settled" || settlement === "unsettled")) {
          body.settlement = settlement;
        }
      }

      if (delivery === "recipients") {
        body.recipients = recipients;
        if (webhookUrl.trim()) body.webhookUrl = webhookUrl.trim();
      }

      if (scheduleEnabled) {
        body.scheduleName = `${cadence === "daily" ? "Daily" : cadence === "weekly" ? "Weekly" : "Monthly"} ${DATASET_OPTIONS.find((item) => item.value === dataset)?.label ?? "payment"} export`;
        body.cadence = cadence;
        body.time = time;
        body.timezone = timezone;
      }

      const response = await createPaymentExport(body);
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
        className="flex max-h-[90vh] w-full max-w-[800px] flex-col rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]"
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
            className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Dataset</h3>
            <div className="flex flex-wrap gap-2">
              {DATASET_OPTIONS.filter((option) => capabilities.datasets.includes(option.value)).map(
                (option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setDataset(option.value);
                    }}
                    className={`rounded-sm border px-4 py-2 text-sm font-medium transition-colors ${
                      dataset === option.value
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                        : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-outline)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ),
              )}
            </div>
          </section>

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
            {hasSensitiveSelected ? (
              <div className="mb-3 flex items-start gap-2 rounded-sm border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-warning)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Selected columns include billing amounts (amount, tax, coupon). Handle exported
                  files according to your data retention policy.
                </span>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 sm:grid-cols-2">
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
                      className="h-4 w-4 rounded-sm border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                    />
                    <span className="text-sm text-[var(--admin-on-surface)] group-hover:text-[var(--admin-primary)]">
                      {column.label}
                    </span>
                  </span>
                  {column.sensitive ? (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--admin-danger)] uppercase">
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
            <div className="flex flex-col gap-4 rounded-sm border border-[var(--admin-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {filterSummary()}
                </div>
                <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Export will be scoped to these filters when enabled.
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
                    {dataset === "orders" ? "Created from" : "Paid from"}
                  </span>
                  <input
                    type="date"
                    value={paidFrom}
                    onChange={(event) => {
                      setPaidFrom(event.target.value);
                    }}
                    className="h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    {dataset === "orders" ? "Created to" : "Paid to"}
                  </span>
                  <input
                    type="date"
                    value={paidTo}
                    onChange={(event) => {
                      setPaidTo(event.target.value);
                    }}
                    className="h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                  />
                </label>
                {dataset === "orders" ? (
                  <label className="flex flex-col gap-2 sm:col-span-2">
                    <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Settlement (optional)
                    </span>
                    <Select
                      value={settlement}
                      onValueChange={setSettlement}
                      options={SETTLEMENT_OPTIONS}
                      className={selectTriggerClassName}
                    />
                  </label>
                ) : null}
                {dataset === "gateways" ? (
                  <label className="flex flex-col gap-2 sm:col-span-2">
                    <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Gateway <span className="text-[var(--admin-danger)]">*</span>
                    </span>
                    <Select
                      value={gatewayKey}
                      onValueChange={setGatewayKey}
                      disabled={gatewaysLoading}
                      options={[
                        {
                          value: "",
                          label: gatewaysLoading ? "Loading gateways…" : "Select gateway",
                        },
                        ...gateways.map((gateway) => ({
                          value: gateway.gatewayKey,
                          label: gateway.displayName,
                        })),
                      ]}
                      className={selectTriggerClassName}
                    />
                  </label>
                ) : null}
                <label className="flex flex-col gap-2 sm:col-span-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Status (optional)
                  </span>
                  <Select
                    value={status}
                    onValueChange={setStatus}
                    options={STATUS_OPTIONS}
                    className={selectTriggerClassName}
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
              Grouping
            </h3>
            <div className="space-y-3 rounded-sm border border-[var(--admin-border)] p-4">
              <label className="flex flex-col gap-2">
                <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  Group by
                </span>
                <Select
                  value={grouping}
                  onValueChange={(value) => {
                    setGrouping(value as PaymentExportGrouping);
                  }}
                  options={GROUPING_OPTIONS}
                  className={selectTriggerClassName}
                />
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={includeSubtotals}
                  onChange={(event) => {
                    setIncludeSubtotals(event.target.checked);
                  }}
                  className="h-4 w-4 rounded-sm border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                />
                <span className="text-sm text-[var(--admin-on-surface)]">
                  Include per-group subtotals
                </span>
              </label>
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Format</h3>
            <div className="inline-flex rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1">
              {capabilities.formats.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFormat(value);
                  }}
                  className={`rounded-sm px-6 py-2 text-[12px] font-semibold tracking-[0.06em] uppercase transition-all ${
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
                    <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2 focus-within:border-[var(--admin-primary)]">
                      {recipients.map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 text-xs text-[var(--admin-on-surface)]"
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
                        placeholder="Add email…"
                        className="min-w-[120px] flex-1 border-none bg-transparent p-0 text-sm text-[var(--admin-on-surface)] outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Webhook URL (optional)
                    </label>
                    <input
                      value={webhookUrl}
                      onChange={(event) => {
                        setWebhookUrl(event.target.value);
                      }}
                      placeholder="https://"
                      className="h-10 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {capabilities.canSchedule ? (
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
                        setCadence(value as PaymentExportCadence);
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
                      className="h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
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
          ) : null}

          <div className="flex items-start gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]"
              aria-hidden="true"
            />
            <span>{capabilities.note}</span>
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

export function AdminPaymentsExportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PaymentExportsPayload | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSchedulePreset, setModalSchedulePreset] = useState(false);
  const [failureItem, setFailureItem] = useState<PaymentExportHistoryItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastRun, setToastRun] = useState<PaymentExportHistoryItem | null>(null);
  const [gateways, setGateways] = useState<PaymentGatewayItem[]>([]);
  const [gatewaysLoading, setGatewaysLoading] = useState(false);
  const statusRef = useRef<Map<string, PaymentExportHistoryItem["status"]>>(new Map());

  const applyPayload = useCallback((next: PaymentExportsPayload) => {
    setPayload(next);
    for (const item of next.history) {
      if (!statusRef.current.has(item.id)) {
        statusRef.current.set(item.id, item.status);
      }
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPaymentExports();
      applyPayload(response.data);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not load exports.");
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  const loadGateways = useCallback(async () => {
    setGatewaysLoading(true);
    try {
      const response = await fetchPaymentGateways();
      setGateways(response.data.items);
    } catch {
      setGateways([]);
    } finally {
      setGatewaysLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (modalOpen) void loadGateways();
  }, [modalOpen, loadGateways]);

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
            const response = await fetchPaymentExportRun(id);
            const previousStatus = statusRef.current.get(id);
            statusRef.current.set(id, response.data.status);
            setPayload((current) => {
              if (!current) return current;
              const history = current.history.map((item) =>
                item.id === id ? response.data : item,
              );
              return { ...current, history };
            });
            if (
              response.data.status === "SUCCEEDED" &&
              (previousStatus === "QUEUED" || previousStatus === "RUNNING")
            ) {
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

  function openNewExport(schedulePreset: boolean) {
    setModalSchedulePreset(schedulePreset);
    setModalOpen(true);
  }

  async function onDownload(item: PaymentExportHistoryItem) {
    if (!item.downloadAvailable) return;
    setBusyId(item.id);
    try {
      await downloadPaymentExport(item);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not download export.");
    } finally {
      setBusyId(null);
    }
  }

  async function onRetry(item: PaymentExportHistoryItem) {
    setBusyId(item.id);
    try {
      const response = await retryPaymentExport(item.id);
      statusRef.current.set(response.data.id, response.data.status);
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

  async function onToggleSchedule(schedule: PaymentExportScheduleItem) {
    setBusyId(schedule.id);
    try {
      const response = await updatePaymentExportSchedule(schedule.id, {
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
    }
  }

  async function onDeleteSchedule(schedule: PaymentExportScheduleItem) {
    setBusyId(schedule.id);
    try {
      await deletePaymentExportSchedule(schedule.id);
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
    }
  }

  if (loading || !payload) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div className="h-8 w-48 animate-pulse rounded-sm bg-[var(--admin-surface-high)]" />
        <div className="h-10 w-full animate-pulse rounded-sm bg-[var(--admin-surface-high)]" />
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="h-80 animate-pulse rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-8" />
          <div className="h-80 animate-pulse rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-4" />
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
            <Link href="/admin/reports/payments" className="hover:text-[var(--admin-primary)]">
              Payments
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-[var(--admin-on-surface)]">Exports</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Exports
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            Download payment data or schedule recurring delivery to finance.
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
              openNewExport(false);
            }}
            className={`${primaryButtonClassName} h-10 gap-2`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New export
          </button>
        </div>
      </div>

      <PaymentsReportTabs active="exports" />

      {error ? (
        <div
          className="rounded-sm border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="flex flex-col overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-8">
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              Export history
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <tr>
                  {["File", "Dataset & scope", "Details", "Status", "Action"].map((heading) => (
                    <th
                      key={heading}
                      className={`h-11 px-4 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase ${
                        heading === "Action" ? "text-right" : ""
                      }`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {payload.history.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-sm text-[var(--admin-on-surface-variant)]"
                    >
                      No exports yet. Create one to download payment data.
                    </td>
                  </tr>
                ) : (
                  payload.history.map((item) => {
                    const building = item.status === "QUEUED" || item.status === "RUNNING";
                    const ready = item.status === "SUCCEEDED" && !item.expired;
                    const expired = item.status === "SUCCEEDED" && item.expired;
                    const failed = item.status === "FAILED";

                    return (
                      <tr
                        key={item.id}
                        className={`group relative transition-colors hover:bg-[var(--admin-surface-low)] ${
                          expired ? "opacity-60" : ""
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono text-[13px] ${
                                expired
                                  ? "text-[var(--admin-on-surface-variant)] line-through"
                                  : "text-[var(--admin-on-surface)]"
                              }`}
                            >
                              {item.fileName.replace(/\.(csv|xlsx|json|pdf)$/i, "")}
                            </span>
                            <span className="inline-flex h-6 items-center rounded-sm bg-[var(--admin-surface-high)] px-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)] uppercase">
                              {item.format}
                            </span>
                          </div>
                          {building ? (
                            <DeterminateProgressBar percent={item.progressPercent} />
                          ) : null}
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <span
                            className={`mb-1 inline-flex h-6 items-center rounded-sm px-2 text-[11px] font-semibold tracking-wide uppercase ${datasetChipClassName(item.dataset)}`}
                          >
                            {item.datasetLabel}
                          </span>
                          <p className="truncate text-sm text-[var(--admin-on-surface-variant)]">
                            {item.scopeLabel}
                          </p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {item.rowCount == null ? "—" : item.rowCount.toLocaleString()} rows
                            {item.sizeLabel ? ` · ${item.sizeLabel}` : ""}
                          </div>
                          <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {formatRelative(item.createdAt)}
                          </div>
                          <div className="font-mono text-[11px] text-[var(--admin-outline)]">
                            {formatUtc(item.createdAt)}
                          </div>
                          {expired ? (
                            <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                              Files expire after artifact TTL
                            </p>
                          ) : null}
                        </td>
                        {building ? (
                          <td colSpan={2} className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <span className="inline-flex h-6 animate-pulse items-center rounded-sm bg-[var(--admin-surface-high)] px-2 text-xs font-medium text-[var(--admin-on-surface)]">
                                {item.status === "QUEUED"
                                  ? "Queued"
                                  : item.progressPercent != null
                                    ? `Building ${item.progressPercent}%`
                                    : "Building"}
                              </span>
                              <Loader2
                                className="h-4 w-4 animate-spin text-[var(--admin-outline)]"
                                aria-hidden="true"
                              />
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3">
                              {ready ? (
                                <span className="inline-flex h-6 items-center rounded-sm bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] px-2 text-xs font-medium text-[var(--admin-primary)]">
                                  Ready
                                </span>
                              ) : expired ? (
                                <span className="inline-flex h-6 items-center rounded-sm bg-[var(--admin-surface-high)] px-2 text-xs font-medium text-[var(--admin-on-surface-variant)]">
                                  Expired
                                </span>
                              ) : failed ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFailureItem(item);
                                  }}
                                  className="inline-flex h-6 items-center rounded-sm bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-2 text-xs font-medium text-[var(--admin-danger)]"
                                >
                                  Failed
                                </button>
                              ) : (
                                <span className="inline-flex h-6 items-center rounded-sm bg-[var(--admin-surface-high)] px-2 text-xs font-medium text-[var(--admin-on-surface-variant)]">
                                  {item.status === "CANCELLED" ? "Cancelled" : item.status}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {ready ? (
                                <button
                                  type="button"
                                  onClick={() => void onDownload(item)}
                                  disabled={busyId === item.id}
                                  className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-80"
                                >
                                  <Download className="h-4 w-4" aria-hidden="true" />
                                  Download
                                </button>
                              ) : failed ? (
                                <button
                                  type="button"
                                  onClick={() => void onRetry(item)}
                                  disabled={busyId === item.id}
                                  className="text-sm font-semibold text-[var(--admin-danger)] opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                  Retry
                                </button>
                              ) : (
                                <span className="text-sm text-[var(--admin-on-surface-variant)]">
                                  —
                                </span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-4 lg:col-span-4">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Scheduled exports
          </h2>
          {payload.schedules.map((schedule) => (
            <div
              key={schedule.id}
              className={`relative overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 ${
                schedule.isActive ? "" : "opacity-60"
              }`}
            >
              {schedule.isActive ? (
                <div
                  className="absolute top-0 bottom-0 left-0 w-1 bg-[var(--admin-primary)]"
                  aria-hidden="true"
                />
              ) : null}
              <div className="mb-3 flex items-start justify-between gap-3 pl-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-[var(--admin-on-surface)]">
                    {schedule.name}
                  </h3>
                  <span
                    className={`mt-1 inline-flex h-6 items-center rounded-sm px-2 text-[11px] font-semibold tracking-wide uppercase ${datasetChipClassName(
                      schedule.datasetLabel.toLowerCase().includes("gateway")
                        ? "gateways"
                        : schedule.datasetLabel.toLowerCase().includes("invoice")
                          ? "invoices"
                          : schedule.datasetLabel.toLowerCase().includes("instalment")
                            ? "instalments"
                            : schedule.datasetLabel.toLowerCase().includes("refund")
                              ? "refunds"
                              : "transactions",
                    )}`}
                  >
                    {schedule.datasetLabel}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Delete ${schedule.name}`}
                    disabled={busyId === schedule.id}
                    onClick={() => void onDeleteSchedule(schedule)}
                    className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-danger)]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <PolicyToggle
                    checked={schedule.isActive}
                    disabled={busyId === schedule.id}
                    onChange={() => void onToggleSchedule(schedule)}
                    label={`Toggle ${schedule.name}`}
                  />
                </div>
              </div>
              <p className="mb-3 pl-2 text-sm text-[var(--admin-on-surface-variant)]">
                {schedule.cadenceLabel}
              </p>
              <div className="mb-3 flex flex-wrap gap-2 pl-2">
                {schedule.recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex h-6 items-center gap-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]"
                  >
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    {email}
                  </span>
                ))}
                {schedule.webhookLabel ? (
                  <span className="inline-flex h-6 items-center gap-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                    <Webhook className="h-3.5 w-3.5" aria-hidden="true" />
                    {schedule.webhookLabel}
                  </span>
                ) : null}
                {schedule.formats.map((format) => (
                  <span
                    key={format}
                    className="inline-flex h-6 items-center rounded-sm bg-[var(--admin-surface-high)] px-2 font-mono text-[11px] text-[var(--admin-on-surface)] uppercase"
                  >
                    {format}
                  </span>
                ))}
              </div>
              <p className="flex items-center gap-1.5 pl-2 font-mono text-[11px] text-[var(--admin-primary)]">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                {schedule.nextRunLabel}
              </p>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              openNewExport(true);
            }}
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] p-6 text-[var(--admin-on-surface-variant)] transition-colors hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-semibold">New schedule</span>
          </button>
        </section>
      </div>

      <NewExportModal
        open={modalOpen}
        columns={payload.columns}
        capabilities={payload.capabilities}
        gateways={gateways}
        gatewaysLoading={gatewaysLoading}
        initialScheduleEnabled={modalSchedulePreset}
        onClose={() => {
          setModalOpen(false);
        }}
        onCreated={(run, schedule) => {
          statusRef.current.set(run.id, run.status);
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
        <FailureDrawer
          item={failureItem}
          busy={busyId === failureItem.id}
          onClose={() => {
            setFailureItem(null);
          }}
          onRetry={() => void onRetry(failureItem)}
        />
      ) : null}

      {toastRun ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-lg">
          <CheckCircle2 className="h-5 w-5 text-[var(--admin-success)]" aria-hidden="true" />
          <span className="text-sm text-[var(--admin-on-surface)]">
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
            className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
