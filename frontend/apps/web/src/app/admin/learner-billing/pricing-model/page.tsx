import type {
  BillingLocationListResponse,
  LearnerBillingConfigResponse,
} from "@atlas/domain-config/schemas/learner-billing";
import type { PaymentGatewayListResponse } from "@atlas/domain-config/schemas/payment-gateway";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { LearnerBillingSettingsShell } from "../../../../features/admin/learner-billing/LearnerBillingSettingsShell";
import { PricingModelPanel } from "../../../../features/admin/learner-billing/PricingModelPanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

async function softGet<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export default async function PricingModelPageRoute() {
  try {
    const [config, gateways, locations] = await Promise.all([
      serverApi.get<LearnerBillingConfigResponse>("/api/v1/learner-billing/config"),
      softGet(
        serverApi.get<PaymentGatewayListResponse>("/api/v1/learner-billing/payment-gateways"),
      ),
      softGet(serverApi.get<BillingLocationListResponse>("/api/v1/learner-billing/locations")),
    ]);

    const paymentGatewayReady = (gateways?.data ?? []).some((gateway) => gateway.isConfigured);
    const gstConfigured = config.data.gst.enabled || Boolean(config.data.gst.number);
    const invoiceConfigured = Boolean(config.data.invoice.prefix);
    const locationsConfigured = (locations?.data ?? []).length > 0;

    return (
      <AdminPageGate screenId="T32" state="ready" title="Pricing Model">
        <LearnerBillingSettingsShell>
          <PricingModelPanel
            initialModel={config.data.pricingModel}
            homeCurrency={config.data.homeCurrency}
            paymentGatewayReady={paymentGatewayReady}
            gstConfigured={gstConfigured}
            invoiceConfigured={invoiceConfigured}
            locationsConfigured={locationsConfigured}
          />
        </LearnerBillingSettingsShell>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T32"
          state="denied"
          title="Pricing Model"
          deniedMessage="You do not have permission to manage pricing model."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T32"
          state="error"
          title="Pricing Model"
          errorMessage={`Failed to load pricing model. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
