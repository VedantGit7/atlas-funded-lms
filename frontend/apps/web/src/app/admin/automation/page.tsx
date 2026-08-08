import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AutomationRulesAdmin } from "../../../features/automation/components/AutomationRulesAdmin";
import { loadPublicTenantBranding } from "../../../lib/server/public-tenant-branding";

export default async function AdminAutomationPage() {
  const branding = await loadPublicTenantBranding({ tenantId: "", requestId: "" });
  const organizationLabel =
    branding.publicName?.trim() || branding.issuerName?.trim() || "Your organization";

  return (
    <AdminPageGate screenId="T16" state="ready" title="Automation Rules">
      <main>
        <AutomationRulesAdmin organizationLabel={organizationLabel} />
      </main>
    </AdminPageGate>
  );
}

// Auth failures (401/403 denied) are handled client-side via ClientApiError in AutomationRulesAdmin.
