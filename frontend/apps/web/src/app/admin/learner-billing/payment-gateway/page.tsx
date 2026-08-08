import type { PaymentGatewayListResponse } from "@atlas/domain-config/schemas/payment-gateway";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { LearnerBillingSettingsShell } from "../../../../features/admin/learner-billing/LearnerBillingSettingsShell";
import { PaymentGatewayListPanel } from "../../../../features/admin/learner-billing/PaymentGatewayListPanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

export default async function PaymentGatewayPageRoute() {
  try {
    const gateways = await serverApi.get<PaymentGatewayListResponse>(
      "/api/v1/learner-billing/payment-gateways",
    );

    return (
      <AdminPageGate screenId="T34" state="ready" title="Payment Gateway">
        <LearnerBillingSettingsShell>
          <PaymentGatewayListPanel initialGateways={gateways.data} />
        </LearnerBillingSettingsShell>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T34"
          state="denied"
          title="Payment Gateway"
          deniedMessage="You do not have permission to manage payment gateways."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T34"
          state="error"
          title="Payment Gateway"
          errorMessage={`Failed to load payment gateways. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
