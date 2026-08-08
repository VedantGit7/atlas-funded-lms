import type { LearnerBillingConfigResponse } from "@atlas/domain-config/schemas/learner-billing";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { GstPanel } from "../../../../features/admin/learner-billing/GstPanel";
import { LearnerBillingSettingsShell } from "../../../../features/admin/learner-billing/LearnerBillingSettingsShell";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

export default async function GstPageRoute() {
  try {
    const config = await serverApi.get<LearnerBillingConfigResponse>(
      "/api/v1/learner-billing/config",
    );

    return (
      <AdminPageGate screenId="T35" state="ready" title="Goods & Service Tax (GST)">
        <LearnerBillingSettingsShell>
          <GstPanel initial={config.data.gst} />
        </LearnerBillingSettingsShell>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T35"
          state="denied"
          title="Goods & Service Tax (GST)"
          deniedMessage="You do not have permission to manage tax settings."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T35"
          state="error"
          title="Goods & Service Tax (GST)"
          errorMessage={`Failed to load tax settings. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
