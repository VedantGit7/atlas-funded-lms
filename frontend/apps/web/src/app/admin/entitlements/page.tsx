import type { EntitlementListResponse } from "@atlas/domain-config/schemas/entitlements";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { EntitlementsList } from "../../../features/admin/entitlements/EntitlementsList";
import { ServerApiError, serverApi } from "../../../lib/server-api";

export default async function AdminEntitlementsPage() {
  try {
    const entitlements = await serverApi.get<EntitlementListResponse>("/api/v1/entitlements");

    return (
      <AdminPageGate screenId="T10" state="ready" title="Entitlements">
        <div className="mx-auto max-w-5xl">
          <EntitlementsList entitlements={entitlements.data} />
        </div>
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
