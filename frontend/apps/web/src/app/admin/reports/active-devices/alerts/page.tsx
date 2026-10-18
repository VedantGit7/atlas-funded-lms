export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminActiveDevicesAlertsPage } from "../../../../../features/admin/reports/AdminActiveDevicesAlertsPage";
import { loadDeviceAlertsData } from "../../../../../lib/server/report-active-devices-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminActiveDevicesAlertsRoutePage() {
  const [gate, initialAlerts] = await Promise.all([runTenantStateGate(), loadDeviceAlertsData()]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Device alerts"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Device alerts">
      <AdminActiveDevicesAlertsPage initialAlerts={initialAlerts} />
    </AdminPageGate>
  );
}
