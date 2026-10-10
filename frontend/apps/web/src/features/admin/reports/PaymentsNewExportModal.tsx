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
  paymentExportsApi,
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
import { PolicyToggle } from "./report-exports-kit";

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

export function PaymentsNewExportModal({
  open,
  columns,
  capabilities,
  initialScheduleEnabled,
  onClose,
  onCreated,
}: {
  open: boolean;
  columns: PaymentExportColumn[];
  capabilities: PaymentExportsPayload["capabilities"];
  initialScheduleEnabled: boolean;
  onClose: () => void;
  onCreated: (run: PaymentExportHistoryItem, schedule: PaymentExportScheduleItem | null) => void;
}) {
  const titleId = useId();
  const [gateways, setGateways] = useState<PaymentGatewayItem[]>([]);
  const [gatewaysLoading, setGatewaysLoading] = useState(false);
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
    let cancelled = false;
    setGatewaysLoading(true);
    void fetchPaymentGateways()
      .then((response) => {
        if (!cancelled) setGateways(response.data.items);
      })
      .catch(() => {
        if (!cancelled) setGateways([]);
      })
      .finally(() => {
        if (!cancelled) setGatewaysLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

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

      const response = await paymentExportsApi.create(body);
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
