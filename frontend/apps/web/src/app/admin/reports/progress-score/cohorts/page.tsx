export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminProgressScoreCohortsPage } from "../../../../../features/admin/reports/AdminProgressScoreCohortsPage";
import { loadCohortsData } from "../../../../../lib/server/report-progress-score-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminProgressScoreCohortsRoutePage() {
  const [gate, initialCohorts] = await Promise.all([runTenantStateGate(), loadCohortsData()]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Cohorts"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Cohorts">
      <AdminProgressScoreCohortsPage initialCohorts={initialCohorts} />
    </AdminPageGate>
  );
}
