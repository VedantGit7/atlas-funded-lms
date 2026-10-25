import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { MarketingEmailListPanel } from "../../../../../features/admin/grow/MarketingEmailListPanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";
import {
  isMarketingEmailEnabled,
  MARKETING_EMAIL_OFF_MESSAGE,
} from "../../../../../lib/server/marketing-email";

export default async function AdminMarketingEmailPage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T73"
        state="denied"
        title="Marketing Email"
        deniedMessage="This academy is not available."
      />
    );
  }

  if (!isMarketingEmailEnabled()) {
    return (
      <AdminPageGate
        screenId="T73"
        state="denied"
        title="Marketing Email"
        deniedMessage={MARKETING_EMAIL_OFF_MESSAGE}
      />
    );
  }

  return (
    <AdminPageGate screenId="T73" state="ready" title="Marketing Email">
      <MarketingEmailListPanel />
    </AdminPageGate>
  );
}
