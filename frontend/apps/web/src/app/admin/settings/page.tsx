import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminSettingsHub } from "../../../features/admin/settings/AdminSettingsHub";
import {
  ADMIN_SETTINGS_SECTIONS,
  filterAdminSettingsSections,
} from "../../../features/admin/settings/admin-settings-catalog";
import { loadPublicTenantBranding } from "../../../lib/server/public-tenant-branding";
import { loadAdminNavigationProjection } from "../../../lib/server/admin-navigation-projection";
import { runTenantStateGate } from "../../../lib/server/tenant-state-gate";
import { ServerApiError } from "../../../lib/server-api";

export default async function AdminSettingsPage() {
  try {
    const gate = await runTenantStateGate();
    if (gate.kind !== "ok") {
      return (
        <AdminPageGate
          screenId="T27"
          state="denied"
          title="Settings"
          deniedMessage="This academy is not available."
        />
      );
    }

    const [projection, branding] = await Promise.all([
      loadAdminNavigationProjection(),
      loadPublicTenantBranding({
        tenantId: gate.tenant.tenantId,
        requestId: gate.tenant.requestId,
      }),
    ]);

    const sections = filterAdminSettingsSections(ADMIN_SETTINGS_SECTIONS, {
      enabledEntitlements: projection.enabledEntitlements,
      canAccessWorkflowReview: projection.canAccessWorkflowReview,
      canAccessStudio: projection.canAccessStudio,
      canAccessModeration: projection.canAccessModeration,
      canAccessAppealsReview: projection.canAccessAppealsReview,
    });

    const academyName = branding.publicName?.trim() || "your academy";

    return (
      <AdminPageGate screenId="T27" state="ready" title="Settings">
        <AdminSettingsHub sections={sections} academyName={academyName} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T27"
          state="denied"
          title="Settings"
          deniedMessage="You do not have permission to view academy settings."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T27"
          state="error"
          title="Settings"
          errorMessage={`Failed to load settings. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
