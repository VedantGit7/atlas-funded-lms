import type { LearnerBillingConfigResponse } from "@atlas/domain-config/schemas/learner-billing";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { InvoicePanel } from "../../../../features/admin/learner-billing/InvoicePanel";
import { LearnerBillingSettingsShell } from "../../../../features/admin/learner-billing/LearnerBillingSettingsShell";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

export default async function InvoiceConfigPageRoute() {
  try {
    const config = await serverApi.get<LearnerBillingConfigResponse>(
      "/api/v1/learner-billing/config",
    );

    return (
      <AdminPageGate screenId="T37" state="ready" title="Invoice Configuration">
        <LearnerBillingSettingsShell>
          <InvoicePanel initial={config.data.invoice} />
        </LearnerBillingSettingsShell>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T37"
          state="denied"
          title="Invoice Configuration"
          deniedMessage="You do not have permission to manage invoice settings."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T37"
          state="error"
          title="Invoice Configuration"
          errorMessage={`Failed to load invoice settings. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
