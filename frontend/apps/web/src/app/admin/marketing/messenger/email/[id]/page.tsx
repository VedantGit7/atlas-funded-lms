import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { MarketingEmailWizardPanel } from "../../../../../../features/admin/grow/MarketingEmailWizardPanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminMarketingEmailDetailPage({ params }: PageProps) {
  const { id } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T75"
        state="denied"
        title="Marketing Email"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T75" state="ready" title="Marketing Email">
      <MarketingEmailWizardPanel campaignId={id} />
    </AdminPageGate>
  );
}
