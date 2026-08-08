export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminProgressScoreExportsPage } from "../../../../../features/admin/reports/AdminProgressScoreExportsPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminProgressScoreExportsRoutePage() {
  const gate = await runTenantStateGate();
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
      <AdminProgressScoreExportsPage />
    </AdminPageGate>
  );
}
