import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { WhatsappListPanel } from "../../../../../features/admin/grow/WhatsappListPanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminWhatsappPage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T80"
        state="denied"
        title="WhatsApp"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T80" state="ready" title="WhatsApp">
      <WhatsappListPanel />
    </AdminPageGate>
  );
}
