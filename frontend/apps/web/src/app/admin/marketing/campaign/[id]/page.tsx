import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { CampaignBuilderPanel } from "../../../../../features/admin/grow/CampaignBuilderPanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type AdminCampaignBuilderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminCampaignBuilderPage({ params }: AdminCampaignBuilderPageProps) {
  const { id } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T91"
        state="denied"
        title="Campaign Builder"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T91" state="ready" title="Campaign Builder">
      <CampaignBuilderPanel campaignId={id} />
    </AdminPageGate>
  );
}
