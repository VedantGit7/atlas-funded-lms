export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { AdminProgressScoreOverviewPage } from "../../../../features/admin/reports/AdminProgressScoreOverviewPage";
import { runTenantStateGate } from "../../../../lib/server/tenant-state-gate";

export default async function AdminProgressScoreOverviewRoutePage() {
  const gate = await runTenantStateGate();
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
      <AdminProgressScoreOverviewPage />
    </AdminPageGate>
  );
}
