export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminProgressScoreRosterPage } from "../../../../../features/admin/reports/AdminProgressScoreRosterPage";
import { loadScoreProductsData } from "../../../../../lib/server/report-progress-score-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminProgressScoreScoresRoutePage() {
  const [gate, initialScoreProducts] = await Promise.all([
    runTenantStateGate(),
    loadScoreProductsData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Scores"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Scores">
      <AdminProgressScoreRosterPage
        initialMainTab="scores"
        initialScoreProducts={initialScoreProducts}
      />
    </AdminPageGate>
  );
}
