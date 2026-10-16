export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { AdminProgressScoreOverviewPage } from "../../../../features/admin/reports/AdminProgressScoreOverviewPage";
import { loadProgressScoreLandingData } from "../../../../lib/server/report-landing-initial-data";
import { runTenantStateGate } from "../../../../lib/server/tenant-state-gate";

export default async function AdminProgressScoreOverviewRoutePage() {
  const [gate, initialOverview] = await Promise.all([
    runTenantStateGate(),
    loadProgressScoreLandingData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Progress & Score"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Progress & Score">
      <AdminProgressScoreOverviewPage initialOverview={initialOverview} />
    </AdminPageGate>
  );
}
