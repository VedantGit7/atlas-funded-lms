import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { NotificationTemplateManager } from "../../../../features/notifications/components/NotificationTemplateManager";
import { loadPublicTenantBranding } from "../../../../lib/server/public-tenant-branding";

export default async function AdminNotificationTemplatesPage() {
  const branding = await loadPublicTenantBranding({ tenantId: "", requestId: "" });
  const organizationLabel =
    branding.publicName?.trim() || branding.issuerName?.trim() || "Your organization";

  return (
    <AdminPageGate screenId="T15" state="ready" title="Notification Templates">
      <main>
        <NotificationTemplateManager organizationLabel={organizationLabel} />
      </main>
    </AdminPageGate>
  );
}

// Auth failures (401/403 denied) are handled client-side via ClientApiError in NotificationTemplateManager.
