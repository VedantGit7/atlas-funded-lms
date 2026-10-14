"use client";

import {
  customFieldExportsApi,
  type CustomFieldExportDataset,
  type CustomFieldExportHistoryItem,
  type CustomFieldExportsPayload,
} from "./admin-custom-field-exports-api";
import { CustomFieldNewExportModal } from "./CustomFieldNewExportModal";
import { CustomFieldReportTabs } from "./CustomFieldReportTabs";
import { ReportExportsPage } from "./ReportExportsPage";
import {
  EXPORT_LINK_EXPIRY_NOTE,
  standardExportColumns,
  type ExportDatasetTone,
} from "./report-exports-kit";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";

const DATASET_TONES: Record<CustomFieldExportDataset, ExportDatasetTone> = {
  learner_roster: "primary",
  field_coverage: "success",
  segment_members: "warning",
};

const COLUMNS = standardExportColumns<CustomFieldExportHistoryItem>({
  datasetTone: (dataset) => DATASET_TONES[dataset],
  expiredCaption: "File expired",
});

export function AdminCustomFieldExportsPage({
  initialExports,
}: {
  /** The exports the server loaded, if it could. */
  initialExports?: ReportInitialData<CustomFieldExportsPayload> | null | undefined;
}) {
  return (
    <ReportExportsPage
      api={customFieldExportsApi}
      initialExports={initialExports}
      breadcrumbs={[
        { label: "Reports", href: "/admin/reports" },
        { label: "Custom Field", href: "/admin/reports/custom-field" },
      ]}
      description="Download learner attribute data or schedule recurring delivery."
      tabs={<CustomFieldReportTabs active="exports" />}
      columns={COLUMNS}
      emptyHistoryText="No exports yet. Create one to download learner attribute data."
      footnote={EXPORT_LINK_EXPIRY_NOTE}
      renderNewExport={(slot) => (
        <CustomFieldNewExportModal
          open={slot.open}
          learnerColumns={slot.payload.learnerColumns}
          customFieldColumns={slot.payload.customFieldColumns}
          capabilities={slot.payload.capabilities}
          initialScheduleEnabled={slot.schedulePreset}
          onClose={slot.onClose}
          onCreated={slot.onCreated}
        />
      )}
    />
  );
}
