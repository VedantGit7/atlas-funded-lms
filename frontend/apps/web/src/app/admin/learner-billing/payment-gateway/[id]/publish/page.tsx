import type { PaymentGatewayResponse } from "@atlas/domain-config/schemas/payment-gateway";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { PaymentGatewayConfigShell } from "../../../../../../features/admin/learner-billing/PaymentGatewayConfigShell";
import { PaymentGatewayPublishForm } from "../../../../../../features/admin/learner-billing/PaymentGatewayPublishForm";
import { ServerApiError, serverApi } from "../../../../../../lib/server-api";

export default async function PaymentGatewayPublishPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const gateway = await serverApi.get<PaymentGatewayResponse>(
      `/api/v1/learner-billing/payment-gateways/${id}`,
    );

    return (
      <AdminPageGate screenId="T34" state="ready" title="Payment Gateway">
        <PaymentGatewayConfigShell gatewayId={id}>
          <PaymentGatewayPublishForm gateway={gateway.data} />
        </PaymentGatewayConfigShell>
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
          errorMessage={`Failed to load payment gateway. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
