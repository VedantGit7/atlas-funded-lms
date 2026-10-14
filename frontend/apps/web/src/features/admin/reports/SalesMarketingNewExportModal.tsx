"use client";

import { useEffect, useMemo, useState } from "react";
import { Select } from "@atlas/design-system";
import {
  salesMarketingExportsApi,
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
  exportInputClassName,
  exportSelectTriggerClassName,
} from "./export-dialog-kit";
import { useNewExportForm } from "./use-new-export-form";

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
  const form = useNewExportForm<SmExportFormat, SmExportDelivery, SmExportCadence>({
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
  const defaultDataset = capabilities.datasets[0] ?? "sales";
  const [dataset, setDataset] = useState<SmExportDataset>(defaultDataset);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [attribution, setAttribution] = useState<SmAttributionPresence>("any");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);
  const [grouping, setGrouping] = useState<SmExportGrouping>("none");
  const [includeSubtotals, setIncludeSubtotals] = useState(false);

  const columns = useMemo(() => columnsByDataset[dataset], [columnsByDataset, dataset]);

  const hasSensitiveSelected = useMemo(
    () => columns.some((column) => selected.has(column.key) && column.sensitive),
    [columns, selected],
  );

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
  }, [open, columnsByDataset, capabilities.datasets]);

  useEffect(() => {
    if (!open) return;
    setSelected(
      new Set(columns.filter((column) => column.defaultSelected).map((column) => column.key)),
    );
  }, [open, dataset, columns]);

  if (!open) return null;

  function activitySummary(): string {
    if (dateFrom && dateTo) return `${dateFrom} - ${dateTo}`;
    if (dateFrom) return `From ${dateFrom}`;
    if (dateTo) return `Until ${dateTo}`;
    return "All time";
  }

  function filterSummary(): string {
    // The attribution dataset is an event stream, not product revenue, so a scope
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

  async function onSubmit() {
    if (selected.size === 0) return form.fail("Select at least one column.");
    if (form.delivery === "recipients" && form.recipients.length === 0) {
      return form.fail("Add at least one recipient email.");
    }

    const body: CreateSalesMarketingExportBody = {
      dataset,
      columns: [...selected],
      format: form.format,
      useCurrentFilters,
      delivery: form.delivery,
      scheduleEnabled: form.scheduleEnabled,
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

    if (form.delivery === "recipients") {
      body.recipients = form.recipients;
      if (form.webhookUrl.trim()) body.webhookUrl = form.webhookUrl.trim();
    }

    if (form.scheduleEnabled) {
      const datasetLabel =
        DATASET_OPTIONS.find((item) => item.value === dataset)?.label ?? "Sales & Marketing";
      body.scheduleName = defaultScheduleName(form.cadence, datasetLabel);
      body.cadence = form.cadence;
      body.time = form.time;
      body.timezone = form.timezone;
    }

    return form.submit(() => salesMarketingExportsApi.create(body), onCreated);
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
          {dataset === "attribution" ? (
            <ExportField label="Attribution" className="max-w-xs">
              <Select
                value={attribution}
                onValueChange={(value) => {
                  setAttribution(value as SmAttributionPresence);
                }}
                options={ATTRIBUTION_OPTIONS}
                className={exportSelectTriggerClassName}
              />
            </ExportField>
          ) : (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Product: <span className="text-[var(--admin-on-surface)]">All products</span>
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ExportField label="Date from">
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                }}
                className={exportInputClassName}
              />
            </ExportField>
            <ExportField label="Date to">
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
          <p className="text-xs text-[var(--admin-on-surface-variant)]">{activitySummary()}</p>
        </div>
      </ExportDialogSection>

      <ExportColumnChecklist
        columns={columns}
        selected={selected}
        onToggle={toggleColumn}
        onSelectAll={() => {
          setSelected(new Set(columns.map((column) => column.key)));
        }}
        badgeFor={(key) => (columns.find((column) => column.key === key)?.sensitive ? "pii" : null)}
        warning={hasSensitiveSelected ? "Contains learner personal data" : null}
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

      <ExportDeliverySection
        form={form}
        emailEnabled={capabilities.canEmailDelivery}
        webhook={capabilities.canWebhookDelivery}
      />

      {capabilities.canSchedule ? <ExportScheduleSection form={form} /> : null}

      <ExportDialogNote>{capabilities.note}</ExportDialogNote>
    </ExportDialogFrame>
  );
}
