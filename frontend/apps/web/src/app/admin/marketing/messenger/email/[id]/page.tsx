import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { MarketingEmailWizardPanel } from "../../../../../../features/admin/grow/MarketingEmailWizardPanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";
import {
  isMarketingEmailEnabled,
  MARKETING_EMAIL_OFF_MESSAGE,
} from "../../../../../../lib/server/marketing-email";

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

  if (!isMarketingEmailEnabled()) {
    return (
      <AdminPageGate
        screenId="T75"
        state="denied"
        title="Marketing Email"
        deniedMessage={MARKETING_EMAIL_OFF_MESSAGE}
      />
    );
  }

  return (
    <AdminPageGate screenId="T75" state="ready" title="Marketing Email">
      <MarketingEmailWizardPanel campaignId={id} />
    </AdminPageGate>
  );
}
