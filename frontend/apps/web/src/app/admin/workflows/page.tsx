import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { WorkflowsAdmin } from "../../../features/admin/workflows/WorkflowsAdmin";
import { loadPublicTenantBranding } from "../../../lib/server/public-tenant-branding";

export default async function AdminWorkflowsPage() {
  const branding = await loadPublicTenantBranding({ tenantId: "", requestId: "" });
  const organizationLabel =
    branding.publicName?.trim() || branding.issuerName?.trim() || "Your organization";

  return (
    <AdminPageGate screenId="T17" state="ready" title="Workflows">
      <main>
        <WorkflowsAdmin organizationLabel={organizationLabel} />
      </main>
    </AdminPageGate>
  );
}

// Auth failures (401/403 denied) are handled client-side via ClientApiError in WorkflowsAdmin.
