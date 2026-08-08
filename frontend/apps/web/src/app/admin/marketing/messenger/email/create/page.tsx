import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { MarketingEmailWizardPanel } from "../../../../../../features/admin/grow/MarketingEmailWizardPanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

export default async function AdminMarketingEmailCreatePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T74"
        state="denied"
        title="Create Campaign"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T74" state="ready" title="Create Campaign">
      <MarketingEmailWizardPanel />
    </AdminPageGate>
  );
}
