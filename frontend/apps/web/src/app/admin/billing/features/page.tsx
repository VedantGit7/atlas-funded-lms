import type { EntitlementListResponse } from "@atlas/domain-config/schemas/entitlements";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { AdminFeaturesPage } from "../../../../features/admin/billing/features/AdminFeaturesPage";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

export default async function AdminFeaturesPageRoute() {
  try {
    const entitlements = await serverApi.get<EntitlementListResponse>("/api/v1/entitlements");

    return (
      <AdminPageGate screenId="T28" state="ready" title="Features">
        <AdminFeaturesPage entitlements={entitlements.data} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T28"
          state="denied"
          title="Features"
          deniedMessage="You do not have permission to view features."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T28"
          state="error"
          title="Features"
          errorMessage={`Failed to load features. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
