"use client";

import { liveClassAttendanceExportsApi } from "./admin-live-class-attendance-exports-api";
import { INSIGHT_EXPORT_COLUMNS } from "./insight-report-exports-kit";
import { InsightReportExportsPage } from "./InsightReportExportsPage";
import { LiveClassAttendanceNewExportModal } from "./LiveClassAttendanceNewExportModal";
import { LiveClassAttendanceReportTabs } from "./LiveClassAttendanceReportTabs";

const COLUMNS = [
  INSIGHT_EXPORT_COLUMNS.file,
  INSIGHT_EXPORT_COLUMNS.dataset,
  INSIGHT_EXPORT_COLUMNS.scope,
  INSIGHT_EXPORT_COLUMNS.rows,
  INSIGHT_EXPORT_COLUMNS.size,
  INSIGHT_EXPORT_COLUMNS.created,
];

export function AdminLiveClassAttendanceExportsPage() {
  return (
    <InsightReportExportsPage
      api={liveClassAttendanceExportsApi}
      breadcrumbs={[
        { label: "Live class attendance", href: "/admin/reports/live-class-attendance" },
      ]}
      description="Download attendance data or schedule recurring delivery."
      tabs={<LiveClassAttendanceReportTabs active="exports" />}
      columns={COLUMNS}
      emptyHistoryText="No exports yet. Create one to download attendance data."
      historyNote={(payload) => payload.capabilities.note}
      renderNewExport={(slot) => (
        <LiveClassAttendanceNewExportModal
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
