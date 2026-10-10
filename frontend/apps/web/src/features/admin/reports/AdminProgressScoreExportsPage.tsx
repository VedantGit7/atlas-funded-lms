"use client";

import {
  progressScoreExportsApi,
  type ProgressScoreExportDataset,
  type ProgressScoreExportHistoryItem,
} from "./admin-progress-score-exports-api";
import { ProgressScoreNewExportModal } from "./ProgressScoreNewExportModal";
import { ProgressScoreReportTabs } from "./ProgressScoreReportTabs";
import { ReportExportsPage } from "./ReportExportsPage";
import {
  EXPORT_LINK_EXPIRY_NOTE,
  standardExportColumns,
  type ExportDatasetTone,
} from "./report-exports-kit";

const DATASET_TONES: Record<ProgressScoreExportDataset, ExportDatasetTone> = {
  progress: "primary",
  scores: "success",
  attempts: "warning",
  item_analysis: "neutral",
};

const COLUMNS = standardExportColumns<ProgressScoreExportHistoryItem>({
  datasetTone: (dataset) => DATASET_TONES[dataset],
  expiredCaption: "File expired",
});

export function AdminProgressScoreExportsPage() {
  return (
    <ReportExportsPage
      api={progressScoreExportsApi}
      breadcrumbs={[
        { label: "Reports", href: "/admin/reports/progress-score" },
        { label: "Progress & Score", href: "/admin/reports/progress-score" },
      ]}
      description="Download learner progress and assessment scores, or schedule recurring delivery."
      tabs={<ProgressScoreReportTabs active="exports" />}
      columns={COLUMNS}
      emptyHistoryText="No exports yet. Create one to download progress or score data."
      footnote={EXPORT_LINK_EXPIRY_NOTE}
      renderNewExport={(slot) => (
        <ProgressScoreNewExportModal
          open={slot.open}
          progressColumns={slot.payload.progressColumns}
          scoreColumns={slot.payload.scoreColumns}
          capabilities={slot.payload.capabilities}
          initialScheduleEnabled={slot.schedulePreset}
          onClose={slot.onClose}
          onCreated={slot.onCreated}
        />
      )}
    />
  );
}
