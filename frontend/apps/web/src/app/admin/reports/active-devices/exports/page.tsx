export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminActiveDevicesExportsPage } from "../../../../../features/admin/reports/AdminActiveDevicesExportsPage";
import type { DeviceExportsPayload } from "../../../../../features/admin/reports/admin-active-devices-exports-api";
import { loadReportInitialData } from "../../../../../lib/server/report-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminActiveDevicesExportsRoutePage() {
  const [gate, initialExports] = await Promise.all([
    runTenantStateGate(),
    loadReportInitialData<DeviceExportsPayload>("/api/v1/reports/active-devices/exports"),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Device exports"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Device exports">
      <AdminActiveDevicesExportsPage initialExports={initialExports} />
    </AdminPageGate>
  );
}
