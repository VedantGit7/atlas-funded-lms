import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import type { AdminScreenId } from "../admin-route-registry";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import { SecuritySettingsPlaceholderPage } from "./SecuritySettingsPlaceholderPage";
import { SecuritySettingsShell } from "./SecuritySettingsShell";

type SecuritySettingsPageConfig = {
  screenId: AdminScreenId;
  title: string;
  description: string;
  relatedHref?: string;
  relatedLabel?: string;
};

export function createSecuritySettingsPageRoute(config: SecuritySettingsPageConfig) {
  return async function SecuritySettingsPageRoute() {
    try {
      await serverApi.get("/api/v1/entitlements");

      return (
        <AdminPageGate screenId={config.screenId} state="ready" title={config.title}>
          <SecuritySettingsShell>
            <SecuritySettingsPlaceholderPage
              title={config.title}
              description={config.description}
              {...(config.relatedHref !== undefined ? { relatedHref: config.relatedHref } : {})}
              {...(config.relatedLabel !== undefined ? { relatedLabel: config.relatedLabel } : {})}
            />
          </SecuritySettingsShell>
        </AdminPageGate>
      );
    } catch (error) {
      if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
        return (
          <AdminPageGate
            screenId={config.screenId}
            state="denied"
            title={config.title}
            deniedMessage={`You do not have permission to manage ${config.title.toLowerCase()}.`}
          />
        );
      }

      if (error instanceof ServerApiError) {
        return (
          <AdminPageGate
            screenId={config.screenId}
            state="error"
            title={config.title}
            errorMessage={`Failed to load ${config.title.toLowerCase()}. Request ID: ${error.requestId}`}
          />
        );
      }

      throw error;
    }
  };
}
