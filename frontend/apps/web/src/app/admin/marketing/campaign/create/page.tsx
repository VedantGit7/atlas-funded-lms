import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { CampaignBuilderPanel } from "../../../../../features/admin/grow/CampaignBuilderPanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminCampaignCreatePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T90"
        state="denied"
        title="Create Campaign"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T90" state="ready" title="Create Campaign">
      <CampaignBuilderPanel />
    </AdminPageGate>
  );
}
