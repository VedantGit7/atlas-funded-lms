import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { MarketingEmailWizardPanel } from "../../../../../../features/admin/grow/MarketingEmailWizardPanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";
import {
  isMarketingEmailEnabled,
  MARKETING_EMAIL_OFF_MESSAGE,
} from "../../../../../../lib/server/marketing-email";

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

  if (!isMarketingEmailEnabled()) {
    return (
      <AdminPageGate
        screenId="T74"
        state="denied"
        title="Create Campaign"
        deniedMessage={MARKETING_EMAIL_OFF_MESSAGE}
      />
    );
  }

  return (
    <AdminPageGate screenId="T74" state="ready" title="Create Campaign">
      <MarketingEmailWizardPanel />
    </AdminPageGate>
  );
}
