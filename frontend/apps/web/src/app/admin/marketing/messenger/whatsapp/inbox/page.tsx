import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { WhatsappInboxPanel } from "../../../../../../features/admin/grow/WhatsappInboxPanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

export default async function AdminWhatsappInboxPage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T84"
        state="denied"
        title="WhatsApp Team Inbox"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T84" state="ready" title="WhatsApp Team Inbox">
      <WhatsappInboxPanel />
    </AdminPageGate>
  );
}
