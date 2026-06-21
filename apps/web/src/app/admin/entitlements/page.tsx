import type { EntitlementListResponse } from "@atlas/domain-config/schemas/entitlements";
import { AdminPageGate, PageHeader } from "../../../components/patterns/AdminPageGate";
import { EntitlementsList } from "../../../features/admin/entitlements/EntitlementsList";
import { ServerApiError, serverApi } from "../../../lib/server-api";

export default async function AdminEntitlementsPage() {
  try {
    const entitlements = await serverApi.get<EntitlementListResponse>("/api/v1/entitlements");

    return (
      <AdminPageGate screenId="T10" state="ready" title="Entitlements">
        <main className="space-y-6">
          <PageHeader
            title="Entitlements"
            description="Read-only view of effective tenant entitlements."
          />
          <EntitlementsList entitlements={entitlements.data} />
        </main>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T10"
          state="denied"
          title="Entitlements"
          deniedMessage="You do not have permission to view entitlements."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T10"
          state="error"
          title="Entitlements"
          errorMessage={`Failed to load entitlements. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
