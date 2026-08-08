import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { PushMessageWizardPanel } from "../../../../../../features/admin/grow/PushMessageWizardPanel";
import { loadPublicTenantBranding } from "../../../../../../lib/server/public-tenant-branding";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminPushMessageDetailPage({ params }: PageProps) {
  const { id } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T72"
        state="denied"
        title="Push Message"
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
    <AdminPageGate screenId="T72" state="ready" title="Push Message">
      <PushMessageWizardPanel messageId={id} appLabel={appLabel} />
    </AdminPageGate>
  );
}
