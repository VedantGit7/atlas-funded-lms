"use client";

import {
  batchesExportsApi,
  type BatchExportDataset,
  type BatchExportHistoryItem,
} from "./admin-batches-exports-api";
import { BatchesNewExportDrawer } from "./BatchesNewExportDrawer";
import { BatchesReportTabs } from "./BatchesReportTabs";
import { ReportExportsPage } from "./ReportExportsPage";
import {
  EXPORT_LINK_EXPIRY_NOTE,
  standardExportColumns,
  type ExportDatasetTone,
} from "./report-exports-kit";

const DATASET_TONES: Record<BatchExportDataset, ExportDatasetTone> = {
  batch_summary: "primary",
  batch_learners: "success",
  live_attendance: "warning",
  exams: "primary-soft",
  content: "neutral",
};

const COLUMNS = standardExportColumns<BatchExportHistoryItem>({
  datasetTone: (dataset) => DATASET_TONES[dataset],
  expiredCaption: "Deleted after 7 days",
  details: (item) => (
    <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
      {item.requestedByLabel || "-"}
    </div>
  ),
});

export function AdminBatchesExportsPage() {
  return (
    <ReportExportsPage
      api={batchesExportsApi}
      breadcrumbs={[{ label: "Batches", href: "/admin/reports/batches" }]}
      description="Download batch data or schedule recurring delivery."
      tabs={<BatchesReportTabs active="exports" />}
      columns={COLUMNS}
      emptyHistoryText="No exports yet. Create one to download batch data."
      footnote={EXPORT_LINK_EXPIRY_NOTE}
      renderNewExport={(slot) => (
        <BatchesNewExportDrawer
          open={slot.open}
          summaryColumns={slot.payload.summaryColumns}
          learnerColumns={slot.payload.learnerColumns}
          capabilities={slot.payload.capabilities}
          initialScheduleEnabled={slot.schedulePreset}
          onClose={slot.onClose}
          onCreated={slot.onCreated}
        />
      )}
    />
  );
}
