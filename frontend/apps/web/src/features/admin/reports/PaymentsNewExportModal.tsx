"use client";

import { useEffect, useState } from "react";
import { Select } from "@atlas/design-system";
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
import {
  ExportColumnChecklist,
  ExportDatasetPills,
  ExportDeliverySection,
  ExportDialogFrame,
  ExportDialogNote,
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
  const form = useNewExportForm<PaymentExportFormat, PaymentExportDelivery, PaymentExportCadence>({
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
  const [gateways, setGateways] = useState<PaymentGatewayItem[]>([]);
  const [gatewaysLoading, setGatewaysLoading] = useState(false);
  const [dataset, setDataset] = useState<PaymentExportDataset>("transactions");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paidFrom, setPaidFrom] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [gatewayKey, setGatewayKey] = useState("");
  const [status, setStatus] = useState("");
  const [settlement, setSettlement] = useState("");
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);
  const [grouping, setGrouping] = useState<PaymentExportGrouping>("none");
  const [includeSubtotals, setIncludeSubtotals] = useState(false);

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
    setPaidFrom("");
    setPaidTo("");
    setGatewayKey("");
    setStatus("");
    setSettlement("");
    setUseCurrentFilters(true);
    setGrouping("none");
    setIncludeSubtotals(false);
  }, [open, columns]);

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
    if (paidFrom && paidTo) parts.push(`${paidFrom} - ${paidTo}`);
    else if (paidFrom) parts.push(`From ${paidFrom}`);
    else if (paidTo) parts.push(`Until ${paidTo}`);
    else parts.push("All time");
    return parts.join(" · ");
  }

  async function onSubmit() {
    if (selected.size === 0) return form.fail("Select at least one column.");
    if (dataset === "gateways" && !gatewayKey.trim()) {
      return form.fail("Select a gateway for gateway transaction exports.");
    }
    if (form.delivery === "recipients" && form.recipients.length === 0) {
      return form.fail("Add at least one recipient email.");
    }

    const body: CreatePaymentExportBody = {
      dataset,
      columns: [...selected],
      format: form.format,
      useCurrentFilters,
      grouping,
      includeSubtotals,
      delivery: form.delivery,
      scheduleEnabled: form.scheduleEnabled,
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

    if (form.delivery === "recipients") {
      body.recipients = form.recipients;
      if (form.webhookUrl.trim()) body.webhookUrl = form.webhookUrl.trim();
    }

    if (form.scheduleEnabled) {
      const datasetLabel = DATASET_OPTIONS.find((item) => item.value === dataset)?.label;
      body.scheduleName = defaultScheduleName(form.cadence, datasetLabel ?? "payment");
      body.cadence = form.cadence;
      body.time = form.time;
      body.timezone = form.timezone;
    }

    return form.submit(() => paymentExportsApi.create(body), onCreated);
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
        warning={
          hasSensitiveSelected
            ? "Selected columns include billing amounts (amount, tax, coupon). Handle exported files according to your data retention policy."
            : null
        }
      />

      <ExportFiltersSection
        summary={filterSummary()}
        useCurrentFilters={useCurrentFilters}
        onUseCurrentFiltersChange={setUseCurrentFilters}
      >
        {useCurrentFilters ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ExportField label={dataset === "orders" ? "Created from" : "Paid from"}>
              <input
                type="date"
                value={paidFrom}
                onChange={(event) => {
                  setPaidFrom(event.target.value);
                }}
                className={exportInputClassName}
              />
            </ExportField>
            <ExportField label={dataset === "orders" ? "Created to" : "Paid to"}>
              <input
                type="date"
                value={paidTo}
                onChange={(event) => {
                  setPaidTo(event.target.value);
                }}
                className={exportInputClassName}
              />
            </ExportField>
            {dataset === "orders" ? (
              <ExportField label="Settlement (optional)" className="sm:col-span-2">
                <Select
                  value={settlement}
                  onValueChange={setSettlement}
                  options={SETTLEMENT_OPTIONS}
                  className={exportSelectTriggerClassName}
                />
              </ExportField>
            ) : null}
            {dataset === "gateways" ? (
              <ExportField
                label={
                  <>
                    Gateway <span className="text-[var(--admin-danger)]">*</span>
                  </>
                }
                className="sm:col-span-2"
              >
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
                  className={exportSelectTriggerClassName}
                />
              </ExportField>
            ) : null}
            <ExportField label="Status (optional)" className="sm:col-span-2">
              <Select
                value={status}
                onValueChange={setStatus}
                options={STATUS_OPTIONS}
                className={exportSelectTriggerClassName}
              />
            </ExportField>
          </div>
        ) : null}
      </ExportFiltersSection>

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

      <ExportDeliverySection form={form} webhook />

      {capabilities.canSchedule ? <ExportScheduleSection form={form} /> : null}

      <ExportDialogNote>{capabilities.note}</ExportDialogNote>
    </ExportDialogFrame>
  );
}
