import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { CampaignAnalyticsPanel } from "../../../../../../features/admin/grow/CampaignAnalyticsPanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type AdminCampaignAnalyticsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminCampaignAnalyticsPage({
  params,
}: AdminCampaignAnalyticsPageProps) {
  const { id } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T92"
        state="denied"
        title="Campaign Analytics"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T92" state="ready" title="Campaign Analytics">
      <CampaignAnalyticsPanel campaignId={id} />
    </AdminPageGate>
  );
}
