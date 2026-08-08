import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import type { AdminScreenId } from "../admin-route-registry";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import { LearnerBillingPlaceholderPage } from "./LearnerBillingPlaceholderPage";
import { LearnerBillingSettingsShell } from "./LearnerBillingSettingsShell";

type LearnerBillingPageConfig = {
  screenId: AdminScreenId;
  title: string;
  description: string;
};

export function createLearnerBillingPageRoute(config: LearnerBillingPageConfig) {
  return async function LearnerBillingPageRoute() {
    try {
      await serverApi.get("/api/v1/entitlements");

      return (
        <AdminPageGate screenId={config.screenId} state="ready" title={config.title}>
          <LearnerBillingSettingsShell>
            <LearnerBillingPlaceholderPage title={config.title} description={config.description} />
          </LearnerBillingSettingsShell>
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
