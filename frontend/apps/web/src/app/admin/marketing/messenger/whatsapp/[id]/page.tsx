import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { WhatsappWizardPanel } from "../../../../../../features/admin/grow/WhatsappWizardPanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminWhatsappDetailPage({ params }: PageProps) {
  const { id } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T82"
        state="denied"
        title="WhatsApp Message"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T82" state="ready" title="WhatsApp Message">
      <WhatsappWizardPanel campaignId={id} />
    </AdminPageGate>
  );
}
