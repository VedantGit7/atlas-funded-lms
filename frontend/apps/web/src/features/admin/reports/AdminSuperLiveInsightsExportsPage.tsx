"use client";

import {
  superLiveInsightsExportsApi,
  type SuperLiveInsightsExportsPayload,
} from "./admin-super-live-insights-exports-api";
import { INSIGHT_EXPORT_COLUMNS } from "./insight-report-exports-kit";
import { InsightReportExportsPage } from "./InsightReportExportsPage";
import { SuperLiveInsightsModuleTabs } from "./SuperLiveInsightsModuleTabs";
import { SuperLiveInsightsNewExportModal } from "./SuperLiveInsightsNewExportModal";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";

const COLUMNS = [
  INSIGHT_EXPORT_COLUMNS.file,
  INSIGHT_EXPORT_COLUMNS.dataset,
  INSIGHT_EXPORT_COLUMNS.rows,
  INSIGHT_EXPORT_COLUMNS.size,
  INSIGHT_EXPORT_COLUMNS.created,
];

export function AdminSuperLiveInsightsExportsPage({
  initialExports,
}: {
  /** The exports the server loaded, if it could. */
  initialExports?: ReportInitialData<SuperLiveInsightsExportsPayload> | null | undefined;
}) {
  return (
    <InsightReportExportsPage
      api={superLiveInsightsExportsApi}
      initialExports={initialExports}
      description="Download session metrics or schedule recurring delivery."
      tabs={<SuperLiveInsightsModuleTabs active="exports" />}
      columns={COLUMNS}
      emptyHistoryText="No exports yet. Create one to download session metrics."
      historyNote="Files are deleted after 7 days"
      retryAsCsv
      renderNewExport={(slot) => (
        <SuperLiveInsightsNewExportModal
          open={slot.open}
          capabilities={slot.payload.capabilities}
          estimates={slot.payload.estimates}
          initialScheduleEnabled={slot.schedulePreset}
          onClose={slot.onClose}
          onCreated={slot.onCreated}
        />
      )}
    />
  );
}
