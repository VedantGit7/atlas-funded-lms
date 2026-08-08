export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminCustomFieldExportsPage } from "../../../../../features/admin/reports/AdminCustomFieldExportsPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminCustomFieldExportsRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T52"
        state="denied"
        title="Exports"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T52" state="ready" title="Exports">
      <AdminCustomFieldExportsPage />
    </AdminPageGate>
  );
}
