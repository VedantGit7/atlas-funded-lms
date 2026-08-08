export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminProgressScoreRosterPage } from "../../../../../features/admin/reports/AdminProgressScoreRosterPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminProgressScoreProgressRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Progress"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Progress">
      <AdminProgressScoreRosterPage initialMainTab="progress" />
    </AdminPageGate>
  );
}
