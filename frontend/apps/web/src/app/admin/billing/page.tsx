import type { EntitlementListResponse } from "@atlas/domain-config/schemas/entitlements";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminBillingPage } from "../../../features/admin/billing/AdminBillingPage";
import { buildBillingPlanSummary } from "../../../features/admin/billing/build-billing-summary";
import { ServerApiError, serverApi } from "../../../lib/server-api";

export default async function AdminBillingPageRoute() {
  try {
    const entitlements = await serverApi.get<EntitlementListResponse>("/api/v1/entitlements");
    const summary = buildBillingPlanSummary(entitlements.data);

    return (
      <AdminPageGate screenId="T28" state="ready" title="Billing">
        <AdminBillingPage summary={summary} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T28"
          state="denied"
          title="Billing"
          deniedMessage="You do not have permission to view billing."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T28"
          state="error"
          title="Billing"
          errorMessage={`Failed to load billing. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
