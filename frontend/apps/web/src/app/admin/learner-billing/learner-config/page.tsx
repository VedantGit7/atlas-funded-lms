import type { LearnerBillingConfigResponse } from "@atlas/domain-config/schemas/learner-billing";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { LearnerBillingSettingsShell } from "../../../../features/admin/learner-billing/LearnerBillingSettingsShell";
import { LearnerConfigPanel } from "../../../../features/admin/learner-billing/LearnerConfigPanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

export default async function LearnerConfigPageRoute() {
  try {
    const config = await serverApi.get<LearnerBillingConfigResponse>(
      "/api/v1/learner-billing/config",
    );

    return (
      <AdminPageGate screenId="T36" state="ready" title="Learner Configurations">
        <LearnerBillingSettingsShell>
          <LearnerConfigPanel initial={config.data.learnerConfig} />
        </LearnerBillingSettingsShell>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T36"
          state="denied"
          title="Learner Configurations"
          deniedMessage="You do not have permission to manage learner configurations."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T36"
          state="error"
          title="Learner Configurations"
          errorMessage={`Failed to load learner configurations. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
