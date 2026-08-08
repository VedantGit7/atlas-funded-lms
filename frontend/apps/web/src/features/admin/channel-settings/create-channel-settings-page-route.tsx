import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import type { AdminScreenId } from "../admin-route-registry";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import { ChannelSettingsPlaceholderPage } from "./ChannelSettingsPlaceholderPage";
import { ChannelSettingsShell } from "./ChannelSettingsShell";

type ChannelSettingsPageConfig = {
  screenId: AdminScreenId;
  title: string;
  description: string;
  relatedHref?: string;
  relatedLabel?: string;
};

export function createChannelSettingsPageRoute(config: ChannelSettingsPageConfig) {
  return async function ChannelSettingsPageRoute() {
    try {
      await serverApi.get("/api/v1/entitlements");

      return (
        <AdminPageGate screenId={config.screenId} state="ready" title={config.title}>
          <ChannelSettingsShell>
            <ChannelSettingsPlaceholderPage
              title={config.title}
              description={config.description}
              {...(config.relatedHref !== undefined ? { relatedHref: config.relatedHref } : {})}
              {...(config.relatedLabel !== undefined ? { relatedLabel: config.relatedLabel } : {})}
            />
          </ChannelSettingsShell>
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
