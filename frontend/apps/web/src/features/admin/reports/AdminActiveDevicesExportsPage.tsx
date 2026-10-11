"use client";

import { ActiveDevicesNewExportModal } from "./ActiveDevicesNewExportModal";
import { ActiveDevicesReportTabs } from "./ActiveDevicesReportTabs";
import {
  activeDevicesExportsApi,
  type DeviceExportHistoryItem,
} from "./admin-active-devices-exports-api";
import { ReportExportsPage } from "./ReportExportsPage";
import { standardExportColumns } from "./report-exports-kit";

const COLUMNS = standardExportColumns<DeviceExportHistoryItem>({
  datasetTone: () => "neutral",
  expiredCaption: "File expired",
  details: (item) => (
    <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
      {item.requestedByLabel || "-"}
    </div>
  ),
});

export function AdminActiveDevicesExportsPage() {
  return (
    <ReportExportsPage
      api={activeDevicesExportsApi}
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Active Devices", href: "/admin/reports/active-devices" },
      ]}
      description="Download the device roster or schedule recurring delivery to your security team."
      tabs={<ActiveDevicesReportTabs active="exports" />}
      columns={COLUMNS}
      emptyHistoryText="No exports yet. Create one to download the device roster."
      renderNewExport={(slot) => (
        <ActiveDevicesNewExportModal
          open={slot.open}
          columns={slot.payload.columns}
          capabilitiesNote={slot.payload.capabilities.note}
          initialScheduleEnabled={slot.schedulePreset}
          onClose={slot.onClose}
          onCreated={slot.onCreated}
        />
      )}
    />
  );
}
