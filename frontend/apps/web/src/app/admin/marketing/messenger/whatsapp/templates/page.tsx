import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { WhatsappTemplatesPanel } from "../../../../../../features/admin/grow/WhatsappTemplatesPanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

export default async function AdminWhatsappTemplatesPage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T83"
        state="denied"
        title="WhatsApp Templates"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T83" state="ready" title="WhatsApp Templates">
      <WhatsappTemplatesPanel />
    </AdminPageGate>
  );
}
