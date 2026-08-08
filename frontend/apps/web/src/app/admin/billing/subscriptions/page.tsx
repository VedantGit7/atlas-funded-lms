import type { SubscriptionListResponse } from "@atlas/domain-config/schemas/subscriptions";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { AdminSubscriptionsPage } from "../../../../features/admin/billing/subscriptions/AdminSubscriptionsPage";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

export default async function AdminSubscriptionsPageRoute() {
  try {
    const subscriptions = await serverApi.get<SubscriptionListResponse>("/api/v1/subscriptions");

    return (
      <AdminPageGate screenId="T28" state="ready" title="Subscriptions">
        <AdminSubscriptionsPage subscriptions={subscriptions.data} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T28"
          state="denied"
          title="Subscriptions"
          deniedMessage="You do not have permission to view subscriptions."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T28"
          state="error"
          title="Subscriptions"
          errorMessage={`Failed to load subscriptions. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
