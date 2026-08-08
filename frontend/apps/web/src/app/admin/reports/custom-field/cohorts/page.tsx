export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminCustomFieldCohortsPage } from "../../../../../features/admin/reports/AdminCustomFieldCohortsPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminCustomFieldCohortsRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T51"
        state="denied"
        title="Cohorts"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T51" state="ready" title="Cohorts">
      <AdminCustomFieldCohortsPage />
    </AdminPageGate>
  );
}
