import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { SystemEmailListPanel } from "../../../../../features/admin/grow/SystemEmailListPanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminSystemEmailPage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T76"
        state="denied"
        title="System Email"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T76" state="ready" title="System Email">
      <SystemEmailListPanel />
    </AdminPageGate>
  );
}
