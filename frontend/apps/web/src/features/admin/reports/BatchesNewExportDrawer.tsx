"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, Download, Info, Loader2, Search, X } from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  createBatchExport,
  isSummaryDataset,
  type BatchExportCadence,
  type BatchExportColumn,
  type BatchExportDataset,
  type BatchExportDelivery,
  type BatchExportFormat,
  type BatchExportGrouping,
  type BatchExportHistoryItem,
  type BatchExportScheduleItem,
  type BatchesExportsPayload,
  type CreateBatchExportBody,
} from "./admin-batches-exports-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  fetchBatchesRoster,
  type BatchListItem,
} from "./admin-batches-roster-api";

const selectTriggerClassName =
  "h-10 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const DATASET_OPTIONS: Array<{ value: BatchExportDataset; label: string }> = [
  { value: "batch_summary", label: "Batch summary" },
  { value: "batch_learners", label: "Batch learners" },
  { value: "live_attendance", label: "Live attendance" },
  { value: "exams", label: "Exams" },
  { value: "content", label: "Content" },
];

const GROUPING_OPTIONS: Array<{ value: BatchExportGrouping; label: string }> = [
  { value: "none", label: "None" },
  { value: "batch", label: "By batch" },
  { value: "course", label: "By course" },
  { value: "health", label: "By health" },
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
      onClick={() => onChange(!checked)}
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

export function BatchesNewExportDrawer({
  open,
  summaryColumns,
  learnerColumns,
  capabilities,
  initialScheduleEnabled,
  onClose,
  onCreated,
}: {
  open: boolean;
  summaryColumns: BatchExportColumn[];
  learnerColumns: BatchExportColumn[];
  capabilities: BatchesExportsPayload["capabilities"];
  initialScheduleEnabled: boolean;
  onClose: () => void;
  onCreated: (run: BatchExportHistoryItem, schedule: BatchExportScheduleItem | null) => void;
}) {
  const titleId = useId();
  const [dataset, setDataset] = useState<BatchExportDataset>("batch_summary");
  const [batchQuery, setBatchQuery] = useState("");
  const [batchOptions, setBatchOptions] = useState<BatchListItem[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [selectedBatches, setSelectedBatches] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [allActiveBatches, setAllActiveBatches] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);
  const [grouping, setGrouping] = useState<BatchExportGrouping>("none");
  const [includeSubtotals, setIncludeSubtotals] = useState(false);
  const [format, setFormat] = useState<BatchExportFormat>("csv");
  const [delivery, setDelivery] = useState<BatchExportDelivery>("download");
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [cadence, setCadence] = useState<BatchExportCadence>("monthly");
  const [time, setTime] = useState("06:00");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = isSummaryDataset(dataset) ? summaryColumns : learnerColumns;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setDataset("batch_summary");
    setBatchQuery("");
    setBatchOptions([]);
    setSelectedBatches([]);
    setAllActiveBatches(false);
    setDateFrom("");
    setDateTo("");
    setSelected(
      new Set(
        summaryColumns
          .filter((column) => column.defaultSelected)
          .map((column) => column.key),
      ),
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
  }, [open, summaryColumns, initialScheduleEnabled]);

  useEffect(() => {
    if (!open) return;
    setSelected(
      new Set(columns.filter((column) => column.defaultSelected).map((column) => column.key)),
    );
  }, [open, dataset, columns]);

  useEffect(() => {
    if (!open || allActiveBatches) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setBatchesLoading(true);
      void (async () => {
        try {
          const response = await fetchBatchesRoster({
            ...(batchQuery.trim() ? { q: batchQuery.trim() } : {}),
            status: "ACTIVE",
            page: 1,
            limit: 20,
          });
          if (!cancelled) setBatchOptions(response.data.items);
        } catch {
          if (!cancelled) setBatchOptions([]);
        } finally {
          if (!cancelled) setBatchesLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, batchQuery, allActiveBatches]);

  const selectedIds = useMemo(
    () => new Set(selectedBatches.map((batch) => batch.id)),
    [selectedBatches],
  );

  if (!open) return null;

  const hasEmailSelected = selected.has("email");

  function toggleColumn(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addBatch(batch: BatchListItem) {
    setAllActiveBatches(false);
    setSelectedBatches((current) =>
      current.some((item) => item.id === batch.id)
        ? current
        : [...current, { id: batch.id, name: batch.name }],
    );
    setBatchQuery("");
  }

  function removeBatch(id: string) {
    setSelectedBatches((current) => current.filter((item) => item.id !== id));
  }

  function addRecipient() {
    const email = recipientInput.trim();
    if (!email || !email.includes("@")) return;
    setRecipients((current) => (current.includes(email) ? current : [...current, email]));
    setRecipientInput("");
  }

  function scopeSummary(): string {
    if (allActiveBatches) return "All active batches";
    if (selectedBatches.length === 0) return "No batches selected";
    if (selectedBatches.length === 1) return selectedBatches[0]?.name ?? "1 batch";
    return `${selectedBatches.length} batches`;
  }

  function activitySummary(): string {
    if (dateFrom && dateTo) return `${dateFrom} / ${dateTo}`;
    if (dateFrom) return `From ${dateFrom}`;
    if (dateTo) return `Until ${dateTo}`;
    return "All time";
  }

  function filterSummary(): string {
    return `${scopeSummary()} · ${activitySummary()}`;
  }

  async function onSubmit() {
    if (selected.size === 0) {
      setError("Select at least one column.");
      return;
    }
    if (!allActiveBatches && selectedBatches.length === 0) {
      setError("Select at least one batch, or enable All active batches.");
      return;
    }
    if (delivery === "recipients" && recipients.length === 0) {
      setError("Add at least one recipient email.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body: CreateBatchExportBody = {
        dataset,
        columns: [...selected],
        format,
        useCurrentFilters,
        delivery,
        scheduleEnabled,
      };

      if (allActiveBatches) {
        body.allActiveBatches = true;
      } else {
        body.batchIds = selectedBatches.map((batch) => batch.id);
      }

      if (useCurrentFilters) {
        const fromIso = dateInputToStartIso(dateFrom);
        const toIso = dateInputToEndIso(dateTo);
        if (fromIso) body.joinedFrom = fromIso;
        if (toIso) body.joinedTo = toIso;
        body.filterSummary = filterSummary();
      }

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
          DATASET_OPTIONS.find((item) => item.value === dataset)?.label ?? "Batch";
        body.scheduleName = `${cadence === "daily" ? "Daily" : cadence === "weekly" ? "Weekly" : "Monthly"} ${datasetLabel} export`;
        body.cadence = cadence;
        body.time = time;
        body.timezone = timezone;
      }

      const response = await createBatchExport(body);
      onCreated(response.data.run, response.data.schedule);
      onClose();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not create export.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
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
                    onClick={() => setDataset(option.value)}
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
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={allActiveBatches}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setAllActiveBatches(next);
                    if (next) setSelectedBatches([]);
                  }}
                  className="h-4 w-4 rounded-sm border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                />
                <span className="text-sm text-[var(--admin-on-surface)]">All active batches</span>
              </label>

              {!allActiveBatches ? (
                <div>
                  <span className="mb-2 block text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Batches
                  </span>
                  <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2 focus-within:border-[var(--admin-primary)]">
                    <div className="mb-2 flex flex-wrap gap-2">
                      {selectedBatches.map((batch) => (
                        <span
                          key={batch.id}
                          className="inline-flex items-center gap-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 text-xs text-[var(--admin-on-surface)]"
                        >
                          {batch.name}
                          <button
                            type="button"
                            aria-label={`Remove ${batch.name}`}
                            className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                            onClick={() => removeBatch(batch.id)}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                        aria-hidden="true"
                      />
                      <input
                        value={batchQuery}
                        onChange={(event) => setBatchQuery(event.target.value)}
                        placeholder="Search batches…"
                        className="h-9 w-full rounded-sm border-none bg-transparent pr-3 pl-8 text-sm text-[var(--admin-on-surface)] outline-none"
                      />
                    </div>
                    {batchesLoading ? (
                      <p className="mt-2 px-2 text-xs text-[var(--admin-on-surface-variant)]">
                        Searching…
                      </p>
                    ) : batchOptions.length > 0 ? (
                      <ul className="mt-2 max-h-40 overflow-y-auto border-t border-[var(--admin-border)] pt-2">
                        {batchOptions.map((batch) => {
                          const already = selectedIds.has(batch.id);
                          return (
                            <li key={batch.id}>
                              <button
                                type="button"
                                disabled={already}
                                onClick={() => addBatch(batch)}
                                className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                              >
                                <span className="truncate">{batch.name}</span>
                                <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                  {batch.key}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : batchQuery.trim() ? (
                      <p className="mt-2 px-2 text-xs text-[var(--admin-on-surface-variant)]">
                        No batches found.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Activity from
                  </span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Activity to
                  </span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                  />
                </label>
              </div>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">{scopeSummary()}</p>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Columns</h3>
              <button
                type="button"
                className="text-sm text-[var(--admin-primary)] hover:underline"
                onClick={() => setSelected(new Set(columns.map((column) => column.key)))}
              >
                Select all
              </button>
            </div>
            {hasEmailSelected ? (
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
                  title={
                    column.key === "email" ? "Contains learner personal data" : undefined
                  }
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(column.key)}
                      onChange={() => toggleColumn(column.key)}
                      className="h-4 w-4 rounded-sm border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                    />
                    <span className="text-sm text-[var(--admin-on-surface)] group-hover:text-[var(--admin-primary)]">
                      {column.label}
                    </span>
                  </span>
                  {column.key === "email" ? (
                    <span
                      title="Contains learner personal data"
                      className="inline-flex items-center gap-1 rounded-sm bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--admin-warning)] uppercase"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      PII
                    </span>
                  ) : column.sensitive ? (
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
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Grouping</h3>
            <div className="space-y-3 rounded-sm border border-[var(--admin-border)] p-4">
              <label className="flex flex-col gap-2">
                <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  Group by
                </span>
                <Select
                  value={grouping}
                  onValueChange={(value) => {
                    const next = value as BatchExportGrouping;
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
                  onChange={(event) => setIncludeSubtotals(event.target.checked)}
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
                  onClick={() => setFormat(value)}
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
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Delivery</h3>
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
                    name="batches-export-delivery"
                    checked={delivery === value}
                    onChange={() => setDelivery(value)}
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
                            onClick={() =>
                              setRecipients((current) => current.filter((item) => item !== email))
                            }
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                      <input
                        value={recipientInput}
                        onChange={(event) => setRecipientInput(event.target.value)}
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
                        onChange={(event) => setWebhookUrl(event.target.value)}
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
                      onValueChange={(value) => setCadence(value as BatchExportCadence)}
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
                      onChange={(event) => setTime(event.target.value)}
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
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
            <span>{capabilities.note}</span>
          </div>

          {error ? (
            <p className="text-sm text-[var(--admin-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="sticky bottom-0 flex h-[72px] shrink-0 items-center justify-end gap-4 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6">
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
