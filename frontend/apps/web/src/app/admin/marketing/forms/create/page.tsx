import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { FormsCreatePanel } from "../../../../../features/admin/grow/FormsCreatePanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminFormsCreatePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T87"
        state="denied"
        title="Create Form"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T87" state="ready" title="Create Form">
      <FormsCreatePanel />
    </AdminPageGate>
  );
}
