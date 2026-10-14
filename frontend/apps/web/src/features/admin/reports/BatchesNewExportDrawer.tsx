"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  batchesExportsApi,
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
import {
  ExportColumnChecklist,
  ExportDatasetPills,
  ExportDeliverySection,
  ExportDialogFrame,
  ExportDialogNote,
  ExportDialogSection,
  ExportField,
  ExportFiltersSection,
  ExportFormatSection,
  ExportGroupingSection,
  ExportScheduleSection,
  defaultScheduleName,
  exportCheckboxClassName,
  exportFieldLabelClassName,
  exportInputClassName,
} from "./export-dialog-kit";
import { useNewExportForm } from "./use-new-export-form";

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
  const form = useNewExportForm<BatchExportFormat, BatchExportDelivery, BatchExportCadence>({
    open,
    onClose,
    initialScheduleEnabled,
    defaults: {
      format: "csv",
      delivery: "download",
      cadence: "monthly",
      time: "06:00",
      timezone: "Asia/Kolkata",
    },
  });
  const [dataset, setDataset] = useState<BatchExportDataset>("batch_summary");
  const [batchQuery, setBatchQuery] = useState("");
  const [batchOptions, setBatchOptions] = useState<BatchListItem[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [selectedBatches, setSelectedBatches] = useState<Array<{ id: string; name: string }>>([]);
  const [allActiveBatches, setAllActiveBatches] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);
  const [grouping, setGrouping] = useState<BatchExportGrouping>("none");
  const [includeSubtotals, setIncludeSubtotals] = useState(false);

  const columns = isSummaryDataset(dataset) ? summaryColumns : learnerColumns;

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
        summaryColumns.filter((column) => column.defaultSelected).map((column) => column.key),
      ),
    );
    setUseCurrentFilters(true);
    setGrouping("none");
    setIncludeSubtotals(false);
  }, [open, summaryColumns]);

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
    if (selected.size === 0) return form.fail("Select at least one column.");
    if (!allActiveBatches && selectedBatches.length === 0) {
      return form.fail("Select at least one batch, or enable All active batches.");
    }
    if (form.delivery === "recipients" && form.recipients.length === 0) {
      return form.fail("Add at least one recipient email.");
    }

    const body: CreateBatchExportBody = {
      dataset,
      columns: [...selected],
      format: form.format,
      useCurrentFilters,
      delivery: form.delivery,
      scheduleEnabled: form.scheduleEnabled,
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

    if (form.delivery === "recipients") {
      body.recipients = form.recipients;
      if (form.webhookUrl.trim()) body.webhookUrl = form.webhookUrl.trim();
    }

    if (form.scheduleEnabled) {
      const datasetLabel = DATASET_OPTIONS.find((item) => item.value === dataset)?.label ?? "Batch";
      body.scheduleName = defaultScheduleName(form.cadence, datasetLabel);
      body.cadence = form.cadence;
      body.time = form.time;
      body.timezone = form.timezone;
    }

    return form.submit(() => batchesExportsApi.create(body), onCreated);
  }

  return (
    <ExportDialogFrame
      saving={form.saving}
      error={form.error}
      onClose={onClose}
      onSubmit={() => void onSubmit()}
    >
      <ExportDatasetPills
        options={DATASET_OPTIONS.filter((option) => capabilities.datasets.includes(option.value))}
        value={dataset}
        onChange={setDataset}
      />

      <ExportDialogSection title="Scope">
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
              className={exportCheckboxClassName}
            />
            <span className="text-sm text-[var(--admin-on-surface)]">All active batches</span>
          </label>

          {!allActiveBatches ? (
            <div>
              <span className={`mb-2 block ${exportFieldLabelClassName}`}>Batches</span>
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
                        onClick={() => {
                          removeBatch(batch.id);
                        }}
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
                    onChange={(event) => {
                      setBatchQuery(event.target.value);
                    }}
                    aria-label="Search batches"
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
                    {batchOptions.map((batch) => (
                      <li key={batch.id}>
                        <button
                          type="button"
                          disabled={selectedIds.has(batch.id)}
                          onClick={() => {
                            addBatch(batch);
                          }}
                          className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                        >
                          <span className="truncate">{batch.name}</span>
                          <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {batch.key}
                          </span>
                        </button>
                      </li>
                    ))}
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
            <ExportField label="Activity from">
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                }}
                className={exportInputClassName}
              />
            </ExportField>
            <ExportField label="Activity to">
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                }}
                className={exportInputClassName}
              />
            </ExportField>
          </div>
          <p className="text-xs text-[var(--admin-on-surface-variant)]">{scopeSummary()}</p>
        </div>
      </ExportDialogSection>

      <ExportColumnChecklist
        columns={columns}
        selected={selected}
        onToggle={toggleColumn}
        onSelectAll={() => {
          setSelected(new Set(columns.map((column) => column.key)));
        }}
        badgeFor={(key) =>
          key === "email"
            ? "pii"
            : columns.find((column) => column.key === key)?.sensitive
              ? "sensitive"
              : null
        }
        warning={selected.has("email") ? "Contains learner personal data" : null}
      />

      <ExportFiltersSection
        summary={filterSummary()}
        useCurrentFilters={useCurrentFilters}
        onUseCurrentFiltersChange={setUseCurrentFilters}
      />

      <ExportGroupingSection
        options={GROUPING_OPTIONS}
        grouping={grouping}
        onGroupingChange={setGrouping}
        includeSubtotals={includeSubtotals}
        onIncludeSubtotalsChange={setIncludeSubtotals}
      />

      <ExportFormatSection
        formats={capabilities.formats}
        value={form.format}
        onChange={form.setFormat}
      />

      <ExportDeliverySection form={form} webhook={capabilities.canWebhookDelivery} />

      {capabilities.canSchedule ? <ExportScheduleSection form={form} /> : null}

      <ExportDialogNote>{capabilities.note}</ExportDialogNote>
    </ExportDialogFrame>
  );
}
