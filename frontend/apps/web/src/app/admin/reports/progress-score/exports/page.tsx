export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminProgressScoreExportsPage } from "../../../../../features/admin/reports/AdminProgressScoreExportsPage";
import type { ProgressScoreExportsPayload } from "../../../../../features/admin/reports/admin-progress-score-exports-api";
import { loadReportInitialData } from "../../../../../lib/server/report-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminProgressScoreExportsRoutePage() {
  const [gate, initialExports] = await Promise.all([
    runTenantStateGate(),
    loadReportInitialData<ProgressScoreExportsPayload>("/api/v1/reports/progress-score/exports"),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Exports"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Exports">
      <AdminProgressScoreExportsPage initialExports={initialExports} />
    </AdminPageGate>
  );
}
