import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { WhatsappWizardPanel } from "../../../../../../features/admin/grow/WhatsappWizardPanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

export default async function AdminWhatsappCreatePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T81"
        state="denied"
        title="Create WhatsApp Message"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T81" state="ready" title="Create WhatsApp Message">
      <WhatsappWizardPanel />
    </AdminPageGate>
  );
}
