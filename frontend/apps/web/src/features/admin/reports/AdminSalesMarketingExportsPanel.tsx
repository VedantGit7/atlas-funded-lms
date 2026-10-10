"use client";

import {
  salesMarketingExportsApi,
  type SmExportDataset,
  type SmExportHistoryItem,
} from "./admin-sales-marketing-exports-api";
import { ReportExportsPage } from "./ReportExportsPage";
import { SalesMarketingNewExportModal } from "./SalesMarketingNewExportModal";
import {
  ExportBuildProgress,
  ExportDatasetChip,
  ExportFileName,
  exportRowCount,
  exportRowState,
  formatExportRelative,
  type ExportDatasetTone,
  type ExportHistoryColumn,
} from "./report-exports-kit";

const DATASET_TONES: Record<SmExportDataset, ExportDatasetTone> = {
  sales: "primary",
  coupons: "success",
  "referral-wallet": "warning",
  "affiliate-products": "primary-soft",
  affiliates: "success-soft",
  // The event stream rather than a rollup, so it reads as its own thing in the
  // history list.
  attribution: "muted",
};

const COLUMNS: Array<ExportHistoryColumn<SmExportHistoryItem>> = [
  {
    heading: "File & Dataset",
    className: "max-w-[280px] px-4 py-3",
    render: (item) => (
      <>
        <ExportFileName item={item} wrap />
        <ExportDatasetChip
          className="mt-2"
          label={item.datasetLabel}
          tone={DATASET_TONES[item.dataset]}
        />
        <p className="mt-1 truncate text-sm text-[var(--admin-on-surface-variant)]">
          {item.scopeLabel}
        </p>
        <ExportBuildProgress item={item} />
      </>
    ),
  },
  {
    heading: "Rows",
    className: "px-4 py-3 whitespace-nowrap",
    render: (item) => (
      <>
        <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
          {exportRowCount(item)}
        </div>
        {item.sizeLabel ? (
          <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {item.sizeLabel}
          </div>
        ) : null}
      </>
    ),
  },
  {
    heading: "Created",
    className: "px-4 py-3 whitespace-nowrap",
    render: (item) => (
      <>
        <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
          {formatExportRelative(item.createdAt)}
        </div>
        <div className="font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
          {item.requestedByLabel || "-"}
        </div>
        {exportRowState(item).expired ? (
          <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
            Deleted after 7 days
          </p>
        ) : null}
      </>
    ),
  },
];

/** The Exports tab of the Sales & Marketing report, under that page's header and tabs. */
export function AdminSalesMarketingExportsPanel() {
  return (
    <ReportExportsPage
      api={salesMarketingExportsApi}
      layout="panel"
      description="Download sales & marketing data or schedule recurring delivery."
      columns={COLUMNS}
      emptyHistoryText="No exports yet. Create one to download sales & marketing data."
      search={{ placeholder: "Search exports by file, dataset, or scope…" }}
      historyNote="Files are deleted after ~7 days"
      footnote={(payload) => payload.capabilities.note}
      renderNewExport={(slot) => (
        <SalesMarketingNewExportModal
          open={slot.open}
          columnsByDataset={slot.payload.columnsByDataset}
          capabilities={slot.payload.capabilities}
          initialScheduleEnabled={slot.schedulePreset}
          onClose={slot.onClose}
          onCreated={slot.onCreated}
        />
      )}
    />
  );
}
