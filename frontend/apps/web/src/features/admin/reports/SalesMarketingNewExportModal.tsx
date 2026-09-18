"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, Download, Info, Loader2, X } from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  createSalesMarketingExport,
  type CreateSalesMarketingExportBody,
  type SalesMarketingExportsPayload,
  type SmExportCadence,
  type SmExportDataset,
  type SmExportDelivery,
  type SmExportFormat,
  type SmExportGrouping,
  type SmAttributionPresence,
  type SmExportHistoryItem,
  type SmExportScheduleItem,
} from "./admin-sales-marketing-exports-api";
import { dateInputToEndIso, dateInputToStartIso } from "./admin-sales-marketing-roster-api";

const selectTriggerClassName =
  "h-10 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const DATASET_OPTIONS: Array<{ value: SmExportDataset; label: string }> = [
  { value: "sales", label: "Purchasers" },
  { value: "coupons", label: "Coupons" },
  { value: "referral-wallet", label: "Referral & wallet" },
  { value: "affiliate-products", label: "Affiliate products" },
  { value: "affiliates", label: "Affiliates" },
  { value: "attribution", label: "Attribution events" },
];

const ATTRIBUTION_OPTIONS: Array<{ value: SmAttributionPresence; label: string }> = [
  { value: "any", label: "Any attribution" },
  { value: "attributed", label: "Has UTM" },
  { value: "none", label: "No UTM at all" },
];

const GROUPING_OPTIONS: Array<{ value: SmExportGrouping; label: string }> = [
  { value: "none", label: "None" },
  { value: "product", label: "By product" },
  { value: "month", label: "By month" },
  { value: "currency", label: "By currency" },
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

export function SalesMarketingNewExportModal({
  open,
  columnsByDataset,
  capabilities,
  initialScheduleEnabled,
  onClose,
  onCreated,
}: {
  open: boolean;
  columnsByDataset: SalesMarketingExportsPayload["columnsByDataset"];
  capabilities: SalesMarketingExportsPayload["capabilities"];
  initialScheduleEnabled: boolean;
  onClose: () => void;
  onCreated: (run: SmExportHistoryItem, schedule: SmExportScheduleItem | null) => void;
}) {
  const titleId = useId();
  const defaultDataset = capabilities.datasets[0] ?? "sales";
  const [dataset, setDataset] = useState<SmExportDataset>(defaultDataset);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [attribution, setAttribution] = useState<SmAttributionPresence>("any");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);
  const [grouping, setGrouping] = useState<SmExportGrouping>("none");
  const [includeSubtotals, setIncludeSubtotals] = useState(false);
  const [format, setFormat] = useState<SmExportFormat>("csv");
  const [delivery, setDelivery] = useState<SmExportDelivery>("download");
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [cadence, setCadence] = useState<SmExportCadence>("monthly");
  const [time, setTime] = useState("06:00");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(() => columnsByDataset[dataset], [columnsByDataset, dataset]);

  const hasSensitiveSelected = useMemo(
    () => columns.some((column) => selected.has(column.key) && column.sensitive),
    [columns, selected],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const nextDataset = capabilities.datasets[0] ?? "sales";
    const nextColumns = columnsByDataset[nextDataset];
    setDataset(nextDataset);
    setDateFrom("");
    setDateTo("");
    setSelected(
      new Set(nextColumns.filter((column) => column.defaultSelected).map((column) => column.key)),
    );
    setUseCurrentFilters(true);
    setGrouping("none");
    setIncludeSubtotals(false);
    setFormat("csv");
    setDelivery("download");
    setRecipientInput("");
    setRecipients([]);
    setWebhookUrl("");
    setScheduleEnabled(initialScheduleEnabled);
    setCadence("monthly");
    setTime("06:00");
    setTimezone("Asia/Kolkata");
    setError(null);
  }, [open, columnsByDataset, capabilities.datasets, initialScheduleEnabled]);

  useEffect(() => {
    if (!open) return;
    setSelected(
      new Set(columns.filter((column) => column.defaultSelected).map((column) => column.key)),
    );
  }, [open, dataset, columns]);

  if (!open) return null;

  function activitySummary(): string {
    if (dateFrom && dateTo) return `${dateFrom} – ${dateTo}`;
    if (dateFrom) return `From ${dateFrom}`;
    if (dateTo) return `Until ${dateTo}`;
    return "All time";
  }

  function filterSummary(): string {
    // The attribution dataset is an event stream, not product revenue — a scope
    // label reading "All products" would describe a file that has no product
    // column in it.
    if (dataset === "attribution") {
      const presence =
        attribution === "any" ? "All events" : attribution === "attributed" ? "With UTM" : "No UTM";
      return `${presence} · ${activitySummary()}`;
    }
    return `All products · ${activitySummary()}`;
  }

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
    if (delivery === "recipients" && recipients.length === 0) {
      setError("Add at least one recipient email.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body: CreateSalesMarketingExportBody = {
        dataset,
        columns: [...selected],
        format,
        useCurrentFilters,
        delivery,
        scheduleEnabled,
      };

      const fromIso = dateInputToStartIso(dateFrom);
      const toIso = dateInputToEndIso(dateTo);
      if (fromIso) body.purchasedFrom = fromIso;
      if (toIso) body.purchasedTo = toIso;
      // Sent only where it is honoured. The server refuses it on the other
      // datasets rather than dropping it, so sending it anywhere else would
      // turn an ignored control into a failed export.
      if (dataset === "attribution" && attribution !== "any") {
        body.attribution = attribution;
      }
      body.filterSummary = filterSummary();

      if (grouping !== "none") {
        body.grouping = grouping;
        body.includeSubtotals = includeSubtotals;
      } else {
        body.grouping = "none";
      }

      if (delivery === "recipients") {
        body.recipients = recipients;
        if (webhookUrl.trim()) body.webhookUrl = webhookUrl.trim();
      }

      if (scheduleEnabled) {
        const datasetLabel =
          DATASET_OPTIONS.find((item) => item.value === dataset)?.label ?? "Sales & Marketing";
        body.scheduleName = `${cadence === "daily" ? "Daily" : cadence === "weekly" ? "Weekly" : "Monthly"} ${datasetLabel} export`;
        body.cadence = cadence;
        body.time = time;
        body.timezone = timezone;
      }

      const response = await createSalesMarketingExport(body);
      onCreated(response.data.run, response.data.schedule);
      onClose();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not create export.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6">
          <h2
            id={titleId}
            className="text-xl font-semibold tracking-tight text-[var(--admin-on-surface)]"
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
                    className={`rounded-sm border px-3 py-2 text-sm font-medium transition-colors ${
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
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Scope</h3>
            <div className="space-y-4">
              {dataset === "attribution" ? (
                <label className="flex max-w-xs flex-col gap-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Attribution
                  </span>
                  <Select
                    value={attribution}
                    onValueChange={(value) => {
                      setAttribution(value as SmAttributionPresence);
                    }}
                    options={ATTRIBUTION_OPTIONS}
                    className={selectTriggerClassName}
                  />
                </label>
              ) : (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  Product: <span className="text-[var(--admin-on-surface)]">All products</span>
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Date from
                  </span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                    }}
                    className="h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Date to
                  </span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => {
                      setDateTo(event.target.value);
                    }}
                    className="h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                  />
                </label>
              </div>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">{activitySummary()}</p>
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
                <span>Contains learner personal data</span>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 sm:grid-cols-2">
              {columns.map((column) => (
                <label
                  key={column.key}
                  className="group flex cursor-pointer items-start justify-between gap-3"
                  title={column.sensitive ? "Contains learner personal data" : undefined}
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
                    <span
                      title="Contains learner personal data"
                      className="inline-flex items-center gap-1 rounded-sm bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--admin-warning)] uppercase"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      PII
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Filters</h3>
            <div className="flex flex-col gap-4 rounded-sm border border-[var(--admin-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
              {useCurrentFilters ? (
                <div className="min-w-0 flex-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2">
                  <p className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                    {filterSummary()}
                  </p>
                  <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Matches the scope and roster filters above.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  Export will include all rows for the selected dataset.
                </p>
              )}
              <label className="flex shrink-0 items-center gap-3">
                <span className="text-sm text-[var(--admin-on-surface)]">Use current filters</span>
                <PolicyToggle
                  checked={useCurrentFilters}
                  onChange={setUseCurrentFilters}
                  label="Use current report filters"
                />
              </label>
            </div>
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
                    const next = value as SmExportGrouping;
                    setGrouping(next);
                    if (next === "none") setIncludeSubtotals(false);
                  }}
                  options={GROUPING_OPTIONS}
                  className={selectTriggerClassName}
                />
              </label>
              <label
                className={`flex items-center gap-3 ${grouping === "none" ? "opacity-50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={includeSubtotals}
                  disabled={grouping === "none"}
                  onChange={(event) => {
                    setIncludeSubtotals(event.target.checked);
                  }}
                  className="h-4 w-4 rounded-sm border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)] disabled:cursor-not-allowed"
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
                  className={`rounded-sm px-5 py-2 text-[12px] font-semibold tracking-[0.06em] uppercase transition-all ${
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
                    name="sm-export-delivery"
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
                            aria-label={`Remove ${email}`}
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
                  {capabilities.canWebhookDelivery ? (
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
                  ) : null}
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
                        setCadence(value as SmExportCadence);
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

        <footer className="flex shrink-0 items-center justify-end gap-4 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
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
