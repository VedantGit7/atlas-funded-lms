export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminActiveDevicesPoliciesPage } from "../../../../../features/admin/reports/AdminActiveDevicesPoliciesPage";
import { loadDevicePoliciesData } from "../../../../../lib/server/report-active-devices-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminActiveDevicesPoliciesRoutePage() {
  const [gate, initialPolicies] = await Promise.all([
    runTenantStateGate(),
    loadDevicePoliciesData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Device policies"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Device policies">
      <AdminActiveDevicesPoliciesPage initialPolicies={initialPolicies} />
    </AdminPageGate>
  );
}
