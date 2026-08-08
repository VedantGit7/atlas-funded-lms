import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { PushMessageWizardPanel } from "../../../../../../features/admin/grow/PushMessageWizardPanel";
import { loadPublicTenantBranding } from "../../../../../../lib/server/public-tenant-branding";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

export default async function AdminPushMessageCreatePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T71"
        state="denied"
        title="Create Push Message"
        deniedMessage="This academy is not available."
      />
    );
  }

  const branding = await loadPublicTenantBranding({
    tenantId: gate.tenant.tenantId,
    requestId: gate.tenant.requestId,
  });
  const appLabel = branding.publicName?.trim() || branding.issuerName?.trim() || "Academy";

  return (
    <AdminPageGate screenId="T71" state="ready" title="Create Push Message">
      <PushMessageWizardPanel appLabel={appLabel} />
    </AdminPageGate>
  );
}
