import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { LocalesAdmin } from "../../../features/locales/components/LocalesAdmin";
import { loadPublicTenantBranding } from "../../../lib/server/public-tenant-branding";

export default async function AdminLocalesPage() {
  const branding = await loadPublicTenantBranding({ tenantId: "", requestId: "" });
  const organizationLabel =
    branding.publicName?.trim() || branding.issuerName?.trim() || "Your organization";

  return (
    <AdminPageGate screenId="T18" state="ready" title="Locales">
      <main>
        <LocalesAdmin organizationLabel={organizationLabel} canManage />
      </main>
    </AdminPageGate>
  );
}

// Auth failures (401/403 denied) are handled client-side via ClientApiError in LocalesAdmin.
