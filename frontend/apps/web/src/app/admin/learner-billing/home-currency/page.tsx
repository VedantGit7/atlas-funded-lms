import type { LearnerBillingConfigResponse } from "@atlas/domain-config/schemas/learner-billing";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { LearnerBillingSettingsShell } from "../../../../features/admin/learner-billing/LearnerBillingSettingsShell";
import { HomeCurrencyPanel } from "../../../../features/admin/learner-billing/HomeCurrencyPanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

export default async function HomeCurrencyPageRoute() {
  try {
    const config = await serverApi.get<LearnerBillingConfigResponse>(
      "/api/v1/learner-billing/config",
    );

    return (
      <AdminPageGate screenId="T33" state="ready" title="Home Currency">
        <LearnerBillingSettingsShell>
          <HomeCurrencyPanel initialCurrency={config.data.homeCurrency} />
        </LearnerBillingSettingsShell>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T33"
          state="denied"
          title="Home Currency"
          deniedMessage="You do not have permission to manage home currency."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T33"
          state="error"
          title="Home Currency"
          errorMessage={`Failed to load home currency. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
