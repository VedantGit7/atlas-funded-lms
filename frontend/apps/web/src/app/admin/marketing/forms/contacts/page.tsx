import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { FormsContactsPanel } from "../../../../../features/admin/grow/FormsContactsPanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminFormsContactsPage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T90"
        state="denied"
        title="Contacts"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T90" state="ready" title="Contacts">
      <FormsContactsPanel />
    </AdminPageGate>
  );
}
